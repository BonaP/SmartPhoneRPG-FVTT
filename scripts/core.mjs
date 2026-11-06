import {contactsFor} from './contacts.mjs';
export const ID = 'smartphone-rpg';
export const text = (value, max = 2000) => {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`Texto obrigatório (até ${max} caracteres).`);
  return value.trim();
};
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function canUse(phone, user) {
  return !!phone && !phone.deletionPending && !!user && (user.isGM || (!phone.archived && !phone.disabled && Array.isArray(phone.users) && phone.users.includes(user.id)));
}
export function validateRequest(request, author, from, to) {
  if (!author || !canUse(from, author)) throw Error('Sem acesso ao aparelho de origem.');
  if (!to || to.deletionPending || to.archived || from.archived || to.disabled || from.disabled) throw Error('Aparelho indisponível.');
  requireApp(from,author,'messages');
  if(!isAppEnabled(to,'messages'))throw Error('Mensagens desabilitadas no destinatário.');
  if (!contactsFor(from,author).some(c => c.id === request.to)) throw Error('Contato não cadastrado. Adicione o número à sua agenda.');
  return text(request.body);
}
export function recipients(from, to, users) {
  return [...new Set(users.filter(u => u.isGM || from.users.includes(u.id) || to.users.includes(u.id)).map(u => u.id))];
}
import {requireApp,isAppEnabled} from './apps.mjs';
