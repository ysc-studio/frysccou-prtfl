import { useEffect, useState } from "react";

export type Lang = "en" | "es";

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>("en");
  useEffect(() => {
    const read = () => setLang(document.documentElement.dataset.lang === "es" ? "es" : "en");
    read();
    const mo = new MutationObserver(read);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-lang"] });
    return () => mo.disconnect();
  }, []);
  return lang;
}

const D = {
  dropTitle: { en: "Drop your PDF here", es: "Soltá tu PDF acá" },
  dropSub: { en: "or click to choose a file · it never leaves your device", es: "o hacé click para elegir un archivo · nunca sale de tu dispositivo" },
  choose: { en: "Choose PDF", es: "Elegir PDF" },
  acceptPre: { en: "I have read and accept the", es: "Leí y acepto los" },
  acceptLink: { en: "Terms & Privacy", es: "Términos y Privacidad" },
  needAccept: { en: "File ready. Accept the terms to process it.", es: "Archivo listo. Aceptá los términos para procesarlo." },
  chosenSub: { en: "selected · click to change it", es: "seleccionado · hacé click para cambiarlo" },
  changeFile: { en: "Change file", es: "Cambiar archivo" },
  renderingPages: { en: "Rendering pages…", es: "Renderizando páginas…" },
  renderingNote: { en: "Some parts may not be visible yet. Large files take a moment.", es: "Puede que algunas partes todavía no se vean. Los archivos grandes tardan un momento." },
  continue: { en: "Continue", es: "Continuar" },
  notPdf: { en: "That file is not a PDF.", es: "Ese archivo no es un PDF." },
  tooBig: { en: "That PDF is too large (max 60 MB).", es: "Ese PDF es demasiado pesado (máx. 60 MB)." },
  loadFail: { en: "Could not open this PDF. It may be corrupted or password-protected.", es: "No se pudo abrir este PDF. Puede estar dañado o protegido con contraseña." },
  exportFail: { en: "Could not export the PDF. Try again.", es: "No se pudo exportar el PDF. Probá de nuevo." },
  loading: { en: "Opening PDF…", es: "Abriendo PDF…" },
  tools: { en: "Tools", es: "Herramientas" },
  signature: { en: "Signature", es: "Firma" },
  text: { en: "Text", es: "Texto" },
  date: { en: "Date", es: "Fecha" },
  mySignatures: { en: "My signatures", es: "Mis firmas" },
  noSignatures: { en: "Create one with the signature tool.", es: "Creá una con la herramienta de firma." },
  remove: { en: "Remove from my signatures", es: "Quitar de mis firmas" },
  undo: { en: "Undo", es: "Deshacer" },
  zoom: { en: "Zoom", es: "Zoom" },
  fit: { en: "Fit", es: "Ajustar" },
  placeHint: { en: "Click on the document to place it · Esc to cancel", es: "Hacé click en el documento para ubicarlo · Esc para cancelar" },
  drawTool: { en: "Draw", es: "Dibujar" },
  drawTitle: { en: "Drawing mode on", es: "Modo dibujo activado" },
  drawBody: { en: "Draw directly on the document: tick a box, circle or underline something. Each stroke can be moved or removed afterwards.", es: "Dibujá directo sobre el documento: tildá una casilla, encerrá o subrayá algo. Cada trazo se puede mover o quitar después." },
  drawDone: { en: "Done drawing", es: "Terminar de dibujar" },
  drawHint: { en: "Draw on the document · Esc to finish", es: "Dibujá sobre el documento · Esc para terminar" },
  armedTitle: { en: "Now click on the document", es: "Ahora hacé click en el documento" },
  armedBody: { en: "Don't drag it. Just click the spot on the page where you want it to go.", es: "No lo arrastres. Solo hacé click en el lugar de la página donde lo quieras." },
  selectedBadge: { en: "Selected", es: "Seleccionada" },
  properties: { en: "Properties", es: "Propiedades" },
  selectHint: { en: "Select an item on the page to edit it.", es: "Seleccioná un elemento de la página para editarlo." },
  content: { en: "Content", es: "Contenido" },
  font: { en: "Font", es: "Tipografía" },
  fontText: { en: "Text", es: "Texto" },
  fontSig: { en: "Signature", es: "Firma" },
  size: { en: "Size", es: "Tamaño" },
  color: { en: "Color", es: "Color" },
  bold: { en: "Bold", es: "Negrita" },
  italic: { en: "Italic", es: "Cursiva" },
  thickness: { en: "Thickness", es: "Grosor" },
  outline: { en: "Outline", es: "Contorno" },
  outlineWidth: { en: "Outline width", es: "Grosor del contorno" },
  duplicate: { en: "Duplicate", es: "Duplicar" },
  allPages: { en: "Copy to all pages", es: "Copiar a todas las páginas" },
  delete: { en: "Remove from PDF", es: "Quitar del PDF" },
  download: { en: "Download signed PDF", es: "Descargar PDF firmado" },
  exporting: { en: "Generating…", es: "Generando…" },
  newFile: { en: "Another file", es: "Otro archivo" },
  page: { en: "Page", es: "Página" },
  of: { en: "of", es: "de" },
  emptyNote: { en: "Add at least one item before downloading.", es: "Agregá al menos un elemento antes de descargar." },
  doneTitle: { en: "PDF downloaded", es: "PDF descargado" },
  doneBody: { en: "Your signed file is in your downloads folder.", es: "Tu archivo firmado está en tu carpeta de descargas." },
  close: { en: "Close", es: "Cerrar" },
  sigTitle: { en: "Create your signature", es: "Creá tu firma" },
  draw: { en: "Draw", es: "Dibujar" },
  type: { en: "Type", es: "Escribir" },
  clear: { en: "Clear", es: "Borrar" },
  undoStroke: { en: "Undo stroke", es: "Deshacer trazo" },
  drawHere: { en: "Draw your signature here", es: "Dibujá tu firma acá" },
  typeName: { en: "Type your name", es: "Escribí tu nombre" },
  namePlaceholder: { en: "Your name", es: "Tu nombre" },
  style: { en: "Style", es: "Estilo" },
  useSig: { en: "Use signature", es: "Usar firma" },
  cancel: { en: "Cancel", es: "Cancelar" },
  privacyNote: { en: "Processed 100% in your browser. Nothing is uploaded.", es: "Procesado 100% en tu navegador. No se sube nada." },
  leave: { en: "You have unsaved changes.", es: "Tenés cambios sin guardar." },
} as const;

export type Key = keyof typeof D;

export function makeT(lang: Lang) {
  return (k: Key) => D[k][lang];
}
