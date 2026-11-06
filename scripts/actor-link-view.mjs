import {escapeHTML as esc} from './core.mjs';
import {actorReference,describeActorLink,filterPhonesByActor} from './actor-links.mjs';
import {filterDevices} from './device-management.mjs';
export function renderActorBadge(data,actors) {
  const link=describeActorLink(data,actors);
  return `<div class="srpg-actor-badge" data-actor-state="${link.status}">${link.img?`<img src="${esc(link.img)}" alt="Retrato de ${esc(link.name)}" loading="lazy">`:'<span class="srpg-actor-placeholder" aria-hidden="true">◉</span>'}<span><strong>${esc(link.name)}</strong>${link.status==='missing'?'<small>O aparelho permanece preservado.</small>':''}</span></div>`;
}
export function renderActorLinkEditor(phone,actors) {
  const link=describeActorLink(phone,actors),uuid=actorReference(phone);
  const options=actors.map(actor=>`<option value="${esc(actor.uuid??`Actor.${actor.id}`)}" ${uuid===(actor.uuid??`Actor.${actor.id}`)?'selected':''}>${esc(actor.name)} (${esc(actor.type??'Actor')})</option>`).join('');
  return `<fieldset class="srpg-actor-editor"><legend>Personagem proprietário</legend><label>Vincular a personagem<select name="actorUuid" aria-label="Personagem proprietário"><option value="" ${uuid?'':'selected'}>Sem personagem</option>${link.status==='missing'?`<option value="${esc(uuid)}" selected>Personagem excluído ou indisponível — manter referência</option>`:''}${options}</select></label><div data-actor-preview>${renderActorBadge(phone,actors)}</div>${phone?.id?'<button type="button" data-save-actor>Salvar somente o vínculo</button><small>Vincular, substituir ou selecionar Sem personagem não altera o número nem o acesso dos usuários.</small>':'<small>Opcional. Um personagem pode ter vários aparelhos.</small>'}</fieldset>`;
}
export function renderActorDirectory(phones,filter,actors,{query='',status='active'}={}) {
  const options=[['all','Todos os personagens'],['unlinked','Sem proprietário'],['missing','Personagem excluído ou indisponível'],...actors.map(actor=>[actor.uuid??`Actor.${actor.id}`,actor.name])];
  const filtered=filterDevices(phones,{query,actor:filter,status},actors);
  return `<section class="srpg-actor-directory"><h3>Aparelhos</h3><label>Pesquisar por nome ou número<input type="search" data-device-search aria-label="Pesquisar aparelhos" placeholder="Nome, apelido ou número" value="${esc(query)}"></label><div class="srpg-directory-filters"><label>Filtrar por personagem<select data-actor-filter aria-label="Filtrar aparelhos por personagem">${options.map(([value,label])=>`<option value="${esc(value)}" ${value===filter?'selected':''}>${esc(label)}</option>`).join('')}</select></label><label>Situação<select data-status-filter aria-label="Situação dos aparelhos">${[['active','Ativos'],['archived','Arquivados'],['all','Todos']].map(([value,label])=>`<option value="${value}" ${value===status?'selected':''}>${label}</option>`).join('')}</select></label></div><div data-phone-list>${filtered.map(phone=>`<article class="srpg-phone-entry">${renderDeleteButton(phone)}<span class="srpg-phone-entry-title"><strong>${esc(phone.name)}</strong> · ${esc(phone.phoneNumber??'Numeração pendente')}</span>${renderActorBadge(phone,actors)}<span class="srpg-device-state">${phone.archived?'Arquivado':'Ativo'}${phone.disabled?' · bloqueado':''}</span><div class="srpg-device-actions">${renderDeviceActions(phone)}</div></article>`).join('')||'<p role="status">Nenhum aparelho corresponde à pesquisa e aos filtros.</p>'}</div></section>`;
}

export function renderDeviceActions(phone) {
  const actions=phone.deletionPending?[]:phone.archived?[['restore','Restaurar']]:[['open','Abrir'],['edit','Editar'],['duplicate','Duplicar'],['archive','Arquivar']];
  return actions.map(([action,label])=>action==='edit'?`<button type="button" data-edit="${esc(phone.id)}">${label}</button>`:`<button type="button" class="${action==='delete'?'srpg-destructive':action==='restore'?'srpg-recovery':''}" data-device-action="${action}" data-id="${esc(phone.id)}">${label}</button>`).join('');
}

export function renderDeleteButton(phone) {
  const label=phone.deletionPending?'Retomar exclusão':'Excluir aparelho';
  return `<button type="button" class="srpg-delete-icon" data-device-action="delete" data-id="${esc(phone.id)}" title="${label}" aria-label="${label}: ${esc(phone.name)}"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></svg></button>`;
}
