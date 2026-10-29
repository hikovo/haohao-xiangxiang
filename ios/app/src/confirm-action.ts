// WKWebView does not supply JavaScript confirm dialogs unless its native
// delegate implements them. Keep deletion confirmation inside the app.
export function confirmAction(message: string): Promise<boolean> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog');
    dialog.className = 'app-confirm'; dialog.setAttribute('aria-label', '确认操作');
    const copy = document.createElement('p'); copy.textContent = message;
    const actions = document.createElement('div');
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.textContent = '保留';
    const accept = document.createElement('button'); accept.type = 'button'; accept.textContent = '确认删除'; accept.dataset.confirmAccept = 'true';
    const finish = (value: boolean) => { dialog.close(); dialog.remove(); resolve(value); };
    cancel.onclick = () => finish(false); accept.onclick = () => finish(true);
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(false); });
    actions.append(cancel, accept); dialog.append(copy, actions);
    document.querySelector('#mobile-app')!.append(dialog); dialog.showModal(); cancel.focus({preventScroll: true});
  });
}

export function promptLink(): Promise<string | null> {
  return new Promise(resolve => {
    const dialog = document.createElement('dialog'); dialog.className = 'app-confirm'; dialog.setAttribute('aria-label', '插入链接');
    const label = document.createElement('label'); label.textContent = '粘贴链接地址';
    const input = document.createElement('input'); input.type = 'url'; input.value = 'https://'; input.dataset.linkInput = 'true'; label.append(input);
    const actions = document.createElement('div'); const cancel = document.createElement('button'); cancel.textContent = '取消';
    const accept = document.createElement('button'); accept.textContent = '插入链接'; accept.dataset.linkAccept = 'true';
    const finish = (value: string | null) => { dialog.close(); dialog.remove(); resolve(value); };
    cancel.onclick = () => finish(null); accept.onclick = () => finish(input.value.trim());
    dialog.addEventListener('cancel', event => { event.preventDefault(); finish(null); });
    actions.append(cancel, accept); dialog.append(label, actions); document.querySelector('#mobile-app')!.append(dialog); dialog.showModal(); input.focus();
  });
}
