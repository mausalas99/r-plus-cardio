/** Help center articles and quick help modal. */
import { esc } from '../patients-html.mjs';
import { settingsHelpBridge } from './bridges.mjs';
import { closeSettingsDropdown } from './settings-dropdown.mjs';



var HELP_ARTICLES = [
  {
    id: 'flujo-ic',
    title: 'Flujo IC en R+ Cardio',
    keywords: 'cardio ic descongestion manejo hoja docx flujo laboratorio expediente',
    html:
      '<p><strong>R+ Cardio</strong> documenta el seguimiento de IC descompensada en local (sin LiveSync).</p>' +
      '<ul>' +
      '<li><strong>Laboratorio</strong> — pega SOME, procesa y da de alta pacientes.</li>' +
      '<li><strong>Expediente → Clínico</strong> — HC, Estado actual (descongestión / congestión / POCUS) y Eventualidades.</li>' +
      '<li><strong>Expediente → Manejo</strong> — fantásticos, otros meds y diuréticos con historial de dosis.</li>' +
      '<li><strong>Salida → Generar hoja IC</strong> — .docx institucional a la fecha de corte.</li>' +
      '</ul>'
  },
  {
    id: 'descongestion-ea',
    title: 'Descongestión y Estado actual',
    keywords: 'descongestion diuresis furosemida acumulada congestion pocus estado actual override',
    html:
      '<p>En <strong>Expediente → Clínico → Estado actual</strong> el encabezado de descongestión calcula días, diuresis y furosemida acumuladas.</p>' +
      '<ul>' +
      '<li>Puedes <strong>override manual</strong> de acumulados; <strong>Recalcular</strong> limpia el override.</li>' +
      '<li>Checklist de <strong>congestión</strong> y registro <strong>POCUS</strong> por día.</li>' +
      '<li>Medicamentos activos se leen de <strong>Manejo</strong> (solo lectura en EA).</li>' +
      '</ul>'
  },
  {
    id: 'hoja-ic',
    title: 'Generar hoja IC',
    keywords: 'hoja ic docx salida generar exportar fecha corte plantilla seguimiento',
    html:
      '<p>En <strong>Expediente → Salida</strong> usa <strong>Generar hoja IC</strong> para rellenar el .docx institucional con los datos del paciente.</p>' +
      '<ul>' +
      '<li>Elige la <strong>fecha de corte</strong> (as-of).</li>' +
      '<li>La estructura del documento es fija; solo se rellena contenido.</li>' +
      '<li>La carpeta de salida se configura en <strong>Ajustes</strong>.</li>' +
      '</ul>'
  },
  {
    id: 'primer-paciente',
    title: 'Tu primer paciente',
    keywords: 'agregar paciente nuevo registro edad sexo cuarto cama duplicado',
    html:
      '<p>Agrega un paciente desde la barra lateral con <strong>+ Agregar</strong> o directamente desde un reporte de laboratorio procesado (<strong>Agregar paciente del lab</strong>).</p>' +
      '<ul>' +
      '<li>Puedes capturar nombre, registro, edad, sexo, área / servicio, cuarto y cama.</li>' +
      '<li>R+ Cardio avisa si detecta un paciente con el mismo nombre o registro para evitar duplicados.</li>' +
      '<li>El paciente queda guardado solo en esta computadora; no se sube a la nube.</li>' +
      '</ul>'
  },
  {
    id: 'respaldo-local',
    title: 'Respaldos locales',
    keywords: 'respaldo backup copia seguridad exportar importar paciente sync',
    html:
      '<p>R+ Cardio es <strong>local-first</strong> (sin LiveSync). Usa <strong>Ajustes → Respaldos</strong> para exportar/importar JSON y copias automáticas.</p>' +
      '<ul>' +
      '<li><strong>Copia de seguridad</strong> completa de pacientes y labs.</li>' +
      '<li><strong>Exportar paciente actual</strong> o por rango de fechas.</li>' +
      '<li><strong>Copia automática</strong> con snapshots locales rotativos.</li>' +
      '</ul>'
  },
  {
    id: 'laboratorio',
    title: 'Laboratorio: procesar',
    keywords: 'lab laboratorio procesar reporte diagrama gamble bh quimica copiar',
    html:
      '<p>Pega el reporte del laboratorio en el cuadro de texto de la pestaña <strong>Laboratorio</strong> y pulsa <strong>Procesar</strong>. R+ Cardio reconoce biometría, química, electrolitos, gasometría, pruebas hepáticas y más.</p>' +
      '<ul>' +
      '<li>Cada diagrama tiene un botón <strong>Copiar</strong> para pegarlo como texto en otro sistema.</li>' +
      '<li>Los valores fuera de rango se resaltan en rojo.</li>' +
      '<li>En <strong>Historial de labs</strong> ves cada envío guardado; puedes <strong>Ver en Laboratorio</strong> para recuperar diagramas o <strong>Eliminar</strong> un conjunto si fue un error.</li>' +
      '</ul>'
  },
  {
    id: 'historia-clinica',
    title: 'Historia Clínica',
    keywords: 'historia clinica ingreso app ahf apnp ipas lectura narrativa antecedentes padecimiento',
    html:
      '<p><strong>Expediente → Clínico → Historia Clínica</strong> captura el ingreso con formato institucional.</p>' +
      '<ul>' +
      '<li><strong>Captura</strong> — Tres pasos: identificación y motivo; antecedentes; padecimiento e IPAS.</li>' +
      '<li><strong>Lectura</strong> — Vista que compila secciones en prosa; <strong>Copiar texto</strong> al portapapeles.</li>' +
      '<li>Todo queda en este equipo (sin sync de red).</li>' +
      '</ul>'
  },
  {
    id: 'eventualidades',
    title: 'Eventualidades',
    keywords: 'eventualidades bitacora intercurrencia dia clinico registro',
    html:
      '<p><strong>Expediente → Clínico → Eventualidades</strong> guarda hechos clínicos del ingreso con fecha y texto libre (orden cronológico). Se incluyen en la hoja IC.</p>' +
      '<p style="font-size:13px;color:var(--text-muted);margin:0;">Complementa <strong>Estado actual</strong> (monitoreo estructurado) y <strong>Historia Clínica</strong> (ingreso).</p>'
  },
  {
    id: 'estado-actual',
    title: 'Estado actual y monitoreo',
    keywords: 'estado actual monitoreo vitales glu balance hidrico io tendencias descongestion',
    html:
      '<p><strong>Expediente → Clínico → Estado actual</strong> concentra el monitoreo del día: signos vitales, glucometrías, balance hídrico, descongestión, congestión/POCUS y medicamentos activos.</p>' +
      '<ul>' +
      '<li><strong>Registrar medición</strong> abre el modal de SV / glu / I/O.</li>' +
      '<li>Las gráficas muestran tendencias por familia con puntos alterados.</li>' +
      '<li>Ver también <strong>Descongestión y Estado actual</strong> en este centro de ayuda.</li>' +
      '</ul>'
  },
  {
    id: 'manejo-ic',
    title: 'Manejo (fantásticos y diuréticos)',
    keywords: 'manejo fantasticos diureticos segmentos dosis catalogo furosemida',
    html:
      '<p><strong>Expediente → Manejo</strong> concentra el esquema IC: cuatro pilares (fantásticos), otros medicamentos y diuréticos con historial de dosis.</p>' +
      '<ul>' +
      '<li>Los cambios de dosis cierran el segmento anterior e inician uno nuevo.</li>' +
      '<li>La furosemida acumulada alimenta el encabezado de descongestión.</li>' +
      '<li>La pestaña superior <strong>Manejo</strong> también permite importar la receta SOME del hospital.</li>' +
      '</ul>'
  },
  {
    id: 'medicamentos-receta',
    title: 'Importar receta SOME',
    keywords: 'medicamentos receta tsv hospital soap tratamiento some manejo',
    html:
      '<p>En la pestaña superior <strong>Manejo</strong> pegas el listado copiado del sistema hospitalario (TSV) y pulsas <strong>Importar SOME</strong>.</p>' +
      '<ul>' +
      '<li><strong>SOAP</strong> marca filas para Estado actual; <strong>Excl.</strong> las quita del texto de egreso.</li>' +
      '<li>Los fantásticos/diuréticos del seguimiento IC se editan en <strong>Expediente → Manejo</strong>.</li>' +
      '</ul>'
  },
  {
    id: 'respaldo',
    title: 'Respaldo y portabilidad',
    keywords: 'respaldo backup copia seguridad exportar importar paciente rango sync',
    html:
      '<p>Desde <strong>Ajustes</strong> puedes resguardar datos locales:</p>' +
      '<ul>' +
      '<li><strong>Copia de seguridad</strong>: JSON completo.</li>' +
      '<li><strong>Exportar paciente actual</strong> o por <strong>rango de fechas</strong>.</li>' +
      '<li><strong>Copia automática</strong> con snapshots locales rotativos.</li>' +
      '</ul>'
  },
  {
    id: 'actualizacion',
    title: 'Actualizar R+ Cardio',
    keywords: 'actualizacion actualizar update instalar reiniciar version',
    html:
      '<p>R+ Cardio busca nuevas versiones al iniciar. Cuando hay una disponible, la app muestra un modal con el progreso de descarga.</p>' +
      '<ul>' +
      '<li>Puedes buscar manualmente desde <strong>Ajustes → Buscar actualizaciones…</strong>.</li>' +
      '<li>Al detectar una versión nueva, se muestra una ventana de <strong>Novedades</strong>.</li>' +
      '</ul>'
  },
  {
    id: 'atajos',
    title: 'Atajos de teclado',
    keywords: 'atajos shortcuts teclado ctrl cmd escape tab',
    html:
      '<p>Ahorra tiempo con estos atajos:</p>' +
      '<ul>' +
      '<li><strong>Ctrl/⌘ + 1</strong> — Laboratorio · <strong>2</strong> — Expediente · <strong>3</strong> — Manejo · <strong>4</strong> — Agenda</li>' +
      '<li><strong>Ctrl/⌘ + ,</strong> — Ajustes</li>' +
      '<li><strong>Ctrl/⌘ + P</strong> — Alternar vista Pase</li>' +
      '<li><strong>Ctrl/⌘ + N</strong> — Nuevo paciente</li>' +
      '<li><strong>Esc</strong> — Cerrar modales</li>' +
      '</ul>'
  },
  {
    id: 'privacidad',
    title: 'Privacidad de datos',
    keywords: 'privacidad datos locales electron userdata carpeta no subir nube sensibles',
    html:
      '<p>R+ Cardio guarda toda la información en el <strong>almacenamiento local</strong> de Electron en esta computadora. No envía pacientes ni notas a ningún servidor externo.</p>' +
      '<ul>' +
      '<li>En Ajustes, <strong>Abrir carpeta…</strong> muestra la ruta exacta del perfil de la app.</li>' +
      '<li>No compartas esa carpeta ni los archivos JSON exportados si contienen información sensible.</li>' +
      '</ul>'
  }
];

var helpCurrentArticleId = null;

function openQuickHelp(preselectId) {
  var el = document.getElementById('help-quick-backdrop');
  if (!el) return;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  closeSettingsDropdown();
  var input = document.getElementById('help-search-input');
  if (input) input.value = '';
  renderHelpArticles('');
  var pickId =
    preselectId && HELP_ARTICLES.some(function (a) { return a.id === preselectId; })
      ? preselectId
      : null;
  if (pickId) selectHelpArticle(pickId);
  else if (!helpCurrentArticleId || !HELP_ARTICLES.some(function(a){ return a.id === helpCurrentArticleId; })) {
    selectHelpArticle(HELP_ARTICLES[0].id);
  } else {
    selectHelpArticle(helpCurrentArticleId);
  }
  settingsHelpBridge.syncLearnHubContinueVisibility();
  setTimeout(function(){ if (input) input.focus(); }, 40);
}

export function closeQuickHelp() {
  var el = document.getElementById('help-quick-backdrop');
  if (!el) return;
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
}

function onHelpSearchInput(value) {
  renderHelpArticles(value);
}

function onHelpSearchKeydown(e) {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    var list = document.getElementById('help-articles-list');
    var first = list && list.querySelector('.help-article-item');
    if (first) first.focus();
  } else if (e.key === 'Enter') {
    var list2 = document.getElementById('help-articles-list');
    var first2 = list2 && list2.querySelector('.help-article-item');
    if (first2) {
      e.preventDefault();
      selectHelpArticle(first2.getAttribute('data-article-id'));
      first2.focus();
    }
  }
}

function onHelpListKeydown(e) {
  var target = e.target;
  if (!target || !target.classList || !target.classList.contains('help-article-item')) return;
  var items = Array.prototype.slice.call(document.querySelectorAll('#help-articles-list .help-article-item'));
  var idx = items.indexOf(target);
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    var next = items[Math.min(items.length - 1, idx + 1)];
    if (next) { next.focus(); selectHelpArticle(next.getAttribute('data-article-id')); }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    if (idx <= 0) {
      var input = document.getElementById('help-search-input');
      if (input) input.focus();
    } else {
      items[idx - 1].focus();
      selectHelpArticle(items[idx - 1].getAttribute('data-article-id'));
    }
  } else if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    selectHelpArticle(target.getAttribute('data-article-id'));
  } else if (e.key === 'Home') {
    e.preventDefault();
    if (items[0]) { items[0].focus(); selectHelpArticle(items[0].getAttribute('data-article-id')); }
  } else if (e.key === 'End') {
    e.preventDefault();
    var last = items[items.length - 1];
    if (last) { last.focus(); selectHelpArticle(last.getAttribute('data-article-id')); }
  }
}

function renderHelpArticles(query) {
  var list = document.getElementById('help-articles-list');
  if (!list) return;
  var q = String(query || '').toLowerCase().trim();
  var filtered = HELP_ARTICLES.filter(function(a) {
    if (!q) return true;
    var haystack = (a.title + ' ' + a.keywords + ' ' + a.html.replace(/<[^>]+>/g, ' ')).toLowerCase();
    return haystack.indexOf(q) !== -1;
  });
  list.innerHTML = '';
  if (filtered.length === 0) {
    var empty = document.createElement('div');
    empty.className = 'help-empty';
    empty.textContent = 'Sin resultados para “' + q + '”.';
    list.appendChild(empty);
    return;
  }
  filtered.forEach(function(a) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'help-article-item';
    btn.setAttribute('data-article-id', a.id);
    btn.setAttribute('role', 'option');
    btn.tabIndex = 0;
    btn.textContent = a.title;
    btn.addEventListener('click', function() { selectHelpArticle(a.id); btn.focus(); });
    if (a.id === helpCurrentArticleId) btn.classList.add('active');
    list.appendChild(btn);
  });
  if (helpCurrentArticleId && !filtered.some(function(a){ return a.id === helpCurrentArticleId; })) {
    selectHelpArticle(filtered[0].id);
  }
}

function selectHelpArticle(id) {
  var article = HELP_ARTICLES.find(function(a){ return a.id === id; });
  if (!article) return;
  helpCurrentArticleId = id;
  var contentEl = document.getElementById('help-article-content');
  if (contentEl) {
    contentEl.innerHTML = '<h4>' + esc(article.title) + '</h4>' + article.html;
  }
  var list = document.getElementById('help-articles-list');
  if (list) {
    Array.prototype.forEach.call(list.querySelectorAll('.help-article-item'), function(btn) {
      if (btn.getAttribute('data-article-id') === id) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }
}


export { openQuickHelp, onHelpSearchInput, onHelpSearchKeydown, onHelpListKeydown };
