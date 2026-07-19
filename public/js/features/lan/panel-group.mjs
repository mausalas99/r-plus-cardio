/**
 * Grouped sections for ⇄ panel — auto-fill tiles within a group, stack for connection strip.
 */

var LAN_PANEL_GROUP_SLUG = {
  Conexión: 'connection',
  'Acceso y sala': 'access',
  Administración: 'admin',
};

/**
 * @param {HTMLElement} root
 * @param {string} [title]
 * @param {'stack' | 'grid' | 'list'} [layout]
 * @returns {HTMLElement}
 */
export function appendLanPanelGroup(root, title, layout) {
  var mode = layout === 'stack' ? 'stack' : layout === 'list' ? 'list' : 'grid';
  var wrap = document.createElement('section');
  wrap.className = 'lan-panel-group lan-panel-group--' + mode;

  var slug = title ? LAN_PANEL_GROUP_SLUG[title] : '';
  if (slug) wrap.classList.add('lan-panel-group--' + slug);

  if (title) {
    var heading = document.createElement('h4');
    heading.className = 'lan-panel-group__title';
    heading.textContent = title;
    wrap.appendChild(heading);
  }

  var body = document.createElement('div');
  body.className = 'lan-panel-group__body';
  wrap.appendChild(body);
  root.appendChild(wrap);
  return body;
}

/**
 * @param {HTMLElement} root
 * @returns {HTMLElement}
 */
export function appendLanConnectionStack(root) {
  var stack = document.createElement('div');
  stack.className = 'settings-card-stack lan-connection-stack';
  root.appendChild(stack);
  return stack;
}

/**
 * @param {HTMLElement} root
 * @returns {HTMLElement}
 */
export function appendLanAdminStack(root) {
  var stack = document.createElement('div');
  stack.className = 'settings-card-stack lan-connection-stack lan-connection-stack--admin';
  root.appendChild(stack);
  return stack;
}
