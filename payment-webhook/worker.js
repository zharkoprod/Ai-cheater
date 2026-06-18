/**
 * Приёмник постбэков (HTTP-уведомлений) от ЮKassa для лендинга «Нейро-ЧИТЕР».
 *
 * Как это работает:
 *   1. Человек на лендинге жмёт кнопку → платёжное окно ЮKassa → платит.
 *   2. ЮKassa отправляет POST-уведомление (постбэк) на адрес этого Worker'а.
 *   3. Worker проверяет подлинность платежа через API ЮKassa (чтобы нельзя
 *      было подделать «оплату» чужим запросом).
 *   4. Если платёж реально прошёл — бот пишет уведомление в твой Telegram-чат.
 *
 * Секреты (токен бота, ключи ЮKassa) НЕ хранятся в коде — они задаются
 * переменными окружения в настройках Cloudflare (см. README.md).
 *
 * Нужные переменные окружения (env):
 *   TELEGRAM_BOT_TOKEN   — токен бота от @BotFather
 *   TELEGRAM_CHAT_ID     — id чата/канала, куда слать уведомления
 *   YOOKASSA_SHOP_ID     — идентификатор магазина ЮKassa (shopId)
 *   YOOKASSA_SECRET_KEY  — секретный ключ API ЮKassa
 */

// Соответствие суммы → название тарифа (для текста уведомления).
const TARIFFS = {
  '2990.00': 'Базовый',
  '14900.00': 'Премиум (с разбором)',
};

export default {
  async fetch(request, env) {
    // ЮKassa шлёт только POST. На остальное отвечаем 200, чтобы можно было
    // открыть адрес в браузере и убедиться, что Worker живой.
    if (request.method !== 'POST') {
      return new Response('Neuro-Cheater payment webhook is alive', { status: 200 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return new Response('bad request', { status: 400 });
    }

    const event = body && body.event;
    const obj = (body && body.object) || {};

    // Нас интересует только успешная оплата. На остальные события (отмена,
    // ожидание и т.п.) отвечаем 200, иначе ЮKassa будет слать повторы.
    if (event !== 'payment.succeeded') {
      return new Response('ignored', { status: 200 });
    }

    // Проверяем платёж через API ЮKassa — нельзя доверять телу запроса
    // вслепую, его может подделать кто угодно. Запрашиваем платёж по id
    // и убеждаемся, что он действительно в статусе succeeded.
    const verified = await verifyPayment(obj.id, env);
    if (!verified) {
      // 200, чтобы ЮKassa не зацикливала повторы; сам факт логируем.
      console.log('payment not verified or not succeeded:', obj.id);
      return new Response('not verified', { status: 200 });
    }

    const amount = verified.amount && verified.amount.value;
    const currency = (verified.amount && verified.amount.currency) || 'RUB';
    const description = verified.description || '—';
    const email =
      (verified.receipt && verified.receipt.customer && verified.receipt.customer.email) ||
      (verified.metadata && verified.metadata.email) ||
      '—';
    const tariff = TARIFFS[amount] || description || 'не определён';

    const text =
      '✅ <b>Новая оплата — Нейро-ЧИТЕР</b>\n\n' +
      `💰 Сумма: <b>${amount} ${currency}</b>\n` +
      `📦 Тариф: <b>${escapeHtml(tariff)}</b>\n` +
      `📝 Описание: ${escapeHtml(description)}\n` +
      `✉️ E-mail: ${escapeHtml(email)}\n` +
      `🆔 Платёж: <code>${escapeHtml(verified.id)}</code>\n` +
      `🕒 ${new Date().toLocaleString('ru-RU', { timeZone: 'Europe/Moscow' })} (МСК)`;

    await sendTelegram(env, text);

    return new Response('ok', { status: 200 });
  },
};

// Запрашивает платёж у API ЮKassa и возвращает объект платежа,
// если он действительно в статусе succeeded. Иначе — null.
async function verifyPayment(paymentId, env) {
  if (!paymentId) return null;
  const auth = btoa(`${env.YOOKASSA_SHOP_ID}:${env.YOOKASSA_SECRET_KEY}`);
  const resp = await fetch(`https://api.yookassa.ru/v3/payments/${paymentId}`, {
    method: 'GET',
    headers: { Authorization: `Basic ${auth}` },
  });
  if (!resp.ok) {
    console.log('yookassa api error:', resp.status, await resp.text());
    return null;
  }
  const payment = await resp.json();
  return payment && payment.status === 'succeeded' ? payment : null;
}

// Отправляет сообщение в Telegram через Bot API.
async function sendTelegram(env, text) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!resp.ok) {
    console.log('telegram api error:', resp.status, await resp.text());
  }
}

// Экранирует спецсимволы HTML, чтобы текст из ЮKassa не ломал разметку.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
