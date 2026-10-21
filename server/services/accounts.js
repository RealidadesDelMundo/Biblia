// Borrado completo de los datos de una cuenta (lo usan "Borrar mi cuenta" y el panel de administración).
export async function deleteUserData(db, userId) {
  await db.transaction(async (trx) => {
    for (const t of ['entries', 'candles', 'orders', 'chat_messages', 'scope_flags', 'push_subscriptions', 'reminder_settings', 'password_resets']) await trx(t).where({ user_id: userId }).del();
    await trx('users').where({ id: userId }).del();
  });
}
