// Genera el informe de Feria de Ciencias 2026 en HTML (listo para PDF).
// Proyecto eco-productivo: bioplástico biodegradable de cáscara de papa.
// Uso: node scripts/gen-feria-ciencias.js
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const GREEN = '#2e7d32';
const GREEN_DK = '#1b5e20';
const LEAF = '#66bb6a';
const BLUE = '#1565c0';
const INK = '#1f2937';

const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Feria de Ciencias 2026 — BioPlast Andino</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @page { size: A4; margin: 16mm 15mm; }
  html { background: #e9e9e9; }
  body {
    font-family: "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: ${INK};
    line-height: 1.55;
    font-size: 12.3px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page {
    width: 210mm;
    min-height: 297mm;
    margin: 0 auto;
    background: #fff;
    padding: 18mm 16mm;
    position: relative;
  }
  .page + .page { margin-top: 8mm; }
  p { margin-bottom: 8px; text-align: justify; }
  strong { color: ${GREEN_DK}; }

  /* ── PORTADA ── */
  .cover { display: flex; flex-direction: column; min-height: 261mm; text-align: center; }
  .cover .crest {
    width: 78px; height: 78px; border-radius: 50%; margin: 0 auto;
    border: 3px solid ${GREEN}; display: flex; align-items: center; justify-content: center;
    font-size: 34px; background: #f1f8e9;
  }
  .cover .ie { font-size: 12px; letter-spacing: 2px; text-transform: uppercase; color: #6b7280; margin-top: 14px; }
  .cover .feria {
    margin-top: 6px; font-size: 14px; font-weight: 700; letter-spacing: 3px;
    text-transform: uppercase; color: ${GREEN};
  }
  .cover .big {
    margin-top: 40px; font-size: 13px; letter-spacing: 4px; text-transform: uppercase; color: #9ca3af;
  }
  .cover h1 {
    font-size: 33px; line-height: 1.15; margin: 8px 22px 0; color: ${GREEN_DK}; font-weight: 800;
  }
  .cover h1 .accent { color: ${BLUE}; }
  .cover .sub { margin: 16px 30px 0; font-size: 14px; color: #4b5563; font-style: italic; }
  .cover .tagchips { margin-top: 22px; display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; }
  .cover .chip {
    font-size: 11px; font-weight: 700; padding: 6px 14px; border-radius: 999px;
    background: #e8f5e9; color: ${GREEN_DK}; border: 1px solid ${LEAF};
  }
  .cover .hero-emoji { margin-top: 30px; font-size: 70px; letter-spacing: 6px; }
  .cover .data {
    margin: auto 0 0; border-top: 2px solid #e5e7eb; padding-top: 16px;
    display: grid; grid-template-columns: 1fr 1fr; gap: 8px 26px; text-align: left; font-size: 12.5px;
  }
  .cover .data .row { display: flex; gap: 8px; align-items: baseline; }
  .cover .data .lbl { font-weight: 700; color: ${GREEN_DK}; white-space: nowrap; }
  .cover .data .fill { flex: 1; border-bottom: 1.5px dotted #9ca3af; min-height: 16px; }
  .cover .year { margin-top: 14px; font-size: 16px; font-weight: 800; color: ${GREEN}; letter-spacing: 2px; }

  /* ── SECCIONES ── */
  .sec { margin-bottom: 16px; page-break-inside: avoid; }
  .sec-head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .sec-num {
    width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
    background: ${GREEN}; color: #fff; font-weight: 800; font-size: 13px;
    display: flex; align-items: center; justify-content: center;
  }
  .sec-title { font-size: 17px; font-weight: 800; color: ${GREEN_DK}; }
  .sec-body { padding-left: 36px; }

  ul, ol { padding-left: 18px; margin-bottom: 8px; }
  li { margin-bottom: 5px; text-align: justify; }

  .callout {
    background: #f1f8e9; border-left: 4px solid ${GREEN}; border-radius: 8px;
    padding: 10px 14px; margin: 10px 0; font-size: 12px;
  }
  .callout.blue { background: #e3f2fd; border-left-color: ${BLUE}; }
  .callout.warn { background: #fff8e1; border-left-color: #f9a825; }

  .mat-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 18px; }
  .mat-grid .it { display: flex; gap: 8px; font-size: 12px; }
  .mat-grid .it .dot { color: ${GREEN}; font-weight: 800; }

  .step { display: flex; gap: 12px; margin-bottom: 10px; page-break-inside: avoid; }
  .step .n {
    width: 24px; height: 24px; border-radius: 50%; flex-shrink: 0; margin-top: 1px;
    background: ${BLUE}; color: #fff; font-weight: 800; font-size: 12px;
    display: flex; align-items: center; justify-content: center;
  }
  .step .txt { flex: 1; }
  .step .txt b { color: ${BLUE}; }

  table { width: 100%; border-collapse: collapse; margin: 8px 0; font-size: 11.5px; }
  th { background: ${GREEN}; color: #fff; padding: 7px 8px; text-align: left; font-weight: 700; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr:nth-child(even) td { background: #f6faf3; }

  .photo-box {
    border: 2px dashed #bdbdbd; border-radius: 10px; height: 150px;
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    color: #9e9e9e; font-size: 12px; text-align: center; background: #fafafa;
  }
  .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px; }
  .photo-cap { font-size: 11px; color: #6b7280; text-align: center; margin-top: 4px; }

  .pagefoot {
    position: absolute; bottom: 8mm; left: 16mm; right: 16mm;
    border-top: 1px solid #e5e7eb; padding-top: 5px;
    font-size: 9.5px; color: #9ca3af; display: flex; justify-content: space-between;
  }
  .lead { font-size: 12.5px; color: #374151; }
  .hand {
    font-style: italic; background: #fffdf5; border: 1px dashed #e0d6a8;
    border-radius: 8px; padding: 10px 14px; margin: 10px 0; color: #5b5320;
  }
</style>
</head>
<body>

<!-- ════════ PORTADA ════════ -->
<div class="page cover">
  <div class="crest">🔬</div>
  <div class="ie">Institución Educativa</div>
  <div class="feria">Feria de Ciencias 2026</div>

  <div class="big">Proyecto de Ciencia y Tecnología</div>
  <h1>BioPlast Andino <span class="accent">🥔</span><br/>Bioplástico de cáscara de papa</h1>
  <p class="sub">"Convertir lo que botamos a la basura en un material que cuida el planeta"</p>

  <div class="tagchips">
    <span class="chip">♻️ Eco-Productivo</span>
    <span class="chip">⚗️ Transformación científica</span>
    <span class="chip">👩‍🔬 Trabajo individual</span>
  </div>

  <div class="hero-emoji">🥔 ➜ ⚗️ ➜ ♻️</div>

  <div class="data">
    <div class="row"><span class="lbl">Estudiante:</span><span class="fill"></span></div>
    <div class="row"><span class="lbl">Grado y sección:</span><span class="fill">3.° de secundaria</span></div>
    <div class="row"><span class="lbl">Área:</span><span class="fill">Ciencia y Tecnología</span></div>
    <div class="row"><span class="lbl">Docente:</span><span class="fill"></span></div>
    <div class="row"><span class="lbl">Institución Educativa:</span><span class="fill"></span></div>
    <div class="row"><span class="lbl">Lugar y fecha:</span><span class="fill"></span></div>
  </div>
  <div class="year">— 2026 —</div>
</div>

<!-- ════════ PÁGINA 2 ════════ -->
<div class="page">

  <div class="hand">
    ✍️ <strong>¿Por qué elegí este proyecto?</strong><br/>
    Un día, ayudando a pelar papas en casa, me di cuenta de que botábamos un montón de cáscaras a la
    basura todos los días. Justo esa semana en el colegio hablamos de cuánto contaminan las bolsas de
    plástico. Entonces se me ocurrió una pregunta: <em>¿y si las cáscaras que botamos pudieran convertirse
    en un plástico que sí se degrada?</em> Investigué, probé en mi cocina varias veces (¡las primeras me
    salieron mal!) y al final lo logré. Este informe cuenta cómo lo hice.
  </div>

  <!-- 1. TÍTULO -->
  <div class="sec">
    <div class="sec-head"><div class="sec-num">1</div><div class="sec-title">Título</div></div>
    <div class="sec-body">
      <p><strong>BioPlast Andino:</strong> elaboración de un bioplástico biodegradable a partir del
      almidón de las cáscaras de papa, como alternativa ecológica al plástico de un solo uso.</p>
      <div class="callout blue">
        <strong>Pregunta de investigación:</strong> ¿Es posible transformar las cáscaras de papa
        (un residuo de cocina) en un material plástico que sea moldeable y biodegradable?
      </div>
      <p class="lead"><strong>Hipótesis:</strong> Si extraigo el almidón de las cáscaras de papa y lo
      caliento con vinagre y glicerina, entonces ocurrirá una transformación química que formará una
      lámina flexible parecida al plástico, pero biodegradable.</p>
    </div>
  </div>

  <!-- 2. OBJETIVOS -->
  <div class="sec">
    <div class="sec-head"><div class="sec-num">2</div><div class="sec-title">Objetivos</div></div>
    <div class="sec-body">
      <p><strong>Objetivo general</strong></p>
      <ul>
        <li>Elaborar un bioplástico biodegradable usando el almidón de las cáscaras de papa, para
        demostrar que un residuo de cocina puede transformarse en un material útil y ecológico.</li>
      </ul>
      <p><strong>Objetivos específicos</strong></p>
      <ul>
        <li>Extraer el almidón de las cáscaras de papa que normalmente se botan a la basura.</li>
        <li>Comprobar que el bioplástico se forma mediante una <strong>transformación química</strong>
        (almidón + vinagre + glicerina + calor).</li>
        <li>Demostrar que el material obtenido es <strong>moldeable</strong> y se puede dar forma.</li>
        <li>Verificar que el bioplástico es <strong>biodegradable</strong> a diferencia del plástico común.</li>
        <li>Fomentar el aprovechamiento de los residuos de cocina (proyecto eco-productivo).</li>
      </ul>
    </div>
  </div>

  <!-- 3. IMPORTANCIA -->
  <div class="sec">
    <div class="sec-head"><div class="sec-num">3</div><div class="sec-title">Importancia</div></div>
    <div class="sec-body">
      <p>El plástico de un solo uso (bolsas, sorbetes, empaques) puede tardar
      <strong>más de 100 años en degradarse</strong> y termina contaminando ríos, mares y suelos.
      En el Perú se consumen millones de bolsas plásticas al día, y la papa es uno de nuestros
      alimentos más importantes: existen <strong>más de 3 000 variedades</strong> y se cocina en casi
      todas las casas, así que cáscaras… ¡hay de sobra!</p>
      <p>Mi proyecto es importante porque:</p>
      <ul>
        <li><strong>Es ecológico:</strong> reemplaza un material contaminante por uno que se degrada.</li>
        <li><strong>Es productivo:</strong> aprovecha un residuo (la cáscara) y lo convierte en algo
        nuevo y útil, sin gastar casi nada.</li>
        <li><strong>Es científico:</strong> muestra una transformación química real que puedo explicar y repetir.</li>
        <li><strong>Es replicable:</strong> cualquier familia puede hacerlo en su cocina con cosas que ya tiene.</li>
      </ul>
    </div>
  </div>

  <div class="pagefoot"><span>Feria de Ciencias 2026 · BioPlast Andino</span><span>Página 2</span></div>
</div>

<!-- ════════ PÁGINA 3 ════════ -->
<div class="page">

  <!-- 4. MATERIALES -->
  <div class="sec">
    <div class="sec-head"><div class="sec-num">4</div><div class="sec-title">Materiales</div></div>
    <div class="sec-body">
      <p>Todo es económico y fácil de conseguir en casa o en la bodega/farmacia:</p>
      <div class="mat-grid">
        <div class="it"><span class="dot">•</span> Cáscaras de 3 papas (o 3 cdas. de almidón/chuño)</div>
        <div class="it"><span class="dot">•</span> 4 cucharadas de agua</div>
        <div class="it"><span class="dot">•</span> 1 cucharadita de vinagre blanco</div>
        <div class="it"><span class="dot">•</span> 1 cucharadita de glicerina (de farmacia)</div>
        <div class="it"><span class="dot">•</span> 1 olla pequeña</div>
        <div class="it"><span class="dot">•</span> 1 cuchara de madera</div>
        <div class="it"><span class="dot">•</span> 1 colador y un recipiente</div>
        <div class="it"><span class="dot">•</span> Papel mantequilla o un plato liso</div>
        <div class="it"><span class="dot">•</span> Colorante natural opcional (cúrcuma o betarraga)</div>
        <div class="it"><span class="dot">•</span> Licuadora (opcional, para el almidón)</div>
      </div>
      <div class="callout">
        <strong>Tip de la "científica":</strong> la glicerina es la que hace que el bioplástico salga
        <em>flexible</em> y no se quiebre. Si pones más, queda más blandito; si pones menos, más rígido.
      </div>
    </div>
  </div>

  <!-- 5. PROCEDIMIENTOS -->
  <div class="sec">
    <div class="sec-head"><div class="sec-num">5</div><div class="sec-title">Procedimientos</div></div>
    <div class="sec-body">

      <div class="step"><div class="n">1</div><div class="txt">
        <b>Conseguir el almidón.</b> Lavo bien las cáscaras de papa y las licúo con un poco de agua.
        Cuelo la mezcla y dejo reposar el líquido unos <b>10–15 minutos</b>: el almidón (un polvito
        blanco) se asienta en el fondo. Boto el agua de arriba con cuidado y me quedo con la pasta
        blanca del fondo. <em>(Atajo: puedo usar directamente 3 cucharadas de almidón o chuño.)</em>
      </div></div>

      <div class="step"><div class="n">2</div><div class="txt">
        <b>Preparar la mezcla.</b> En la olla pongo <b>1 cucharada de almidón</b>, <b>4 de agua</b>,
        <b>1 cucharadita de vinagre</b> y <b>1 cucharadita de glicerina</b>. Si quiero color, agrego
        una pizca de cúrcuma. Revuelvo hasta que no queden grumos.
      </div></div>

      <div class="step"><div class="n">3</div><div class="txt">
        <b>Cocinar (con ayuda de un adulto).</b> Caliento a <b>fuego bajo</b> revolviendo todo el
        tiempo durante <b>5 a 10 minutos</b>. La mezcla pasa de líquida y blanca a un <b>gel
        transparente y espeso</b>. ¡Ese cambio es la transformación química!
      </div></div>

      <div class="step"><div class="n">4</div><div class="txt">
        <b>Dar forma.</b> Apago el fuego y vierto el gel sobre papel mantequilla. Lo extiendo delgado
        con la cuchara, o lo pongo en un molde para darle la forma que quiero (una lámina, una bolsita,
        una macetita).
      </div></div>

      <div class="step"><div class="n">5</div><div class="txt">
        <b>Secar.</b> Lo dejo en un lugar ventilado <b>2 a 3 días</b>. Al secar se endurece y queda una
        lámina flexible: <b>mi bioplástico está listo</b>.
      </div></div>

      <div class="step"><div class="n">6</div><div class="txt">
        <b>Probar.</b> Lo doblo para ver si es flexible y entierro un pedacito en tierra húmeda para
        comprobar, en los días siguientes, que <b>sí se degrada</b> (a diferencia del plástico común).
      </div></div>

      <div class="callout warn">
        ⚠️ <strong>Seguridad:</strong> la parte de la cocina la hago siempre <strong>acompañada de un
        adulto</strong>, porque se usa fuego y la mezcla queda muy caliente.
      </div>

      <div class="callout blue">
        🧪 <strong>¿Qué pasa por dentro? (la ciencia):</strong> el almidón es un <em>polímero natural</em>
        (cadenas largas de azúcar). El <em>calor</em> y el <em>vinagre</em> rompen y reorganizan esas
        cadenas, y la <em>glicerina</em> actúa como <em>plastificante</em> (se mete entre las cadenas y
        las hace deslizarse), por eso el resultado es flexible como un plástico.
      </div>
    </div>
  </div>

  <div class="pagefoot"><span>Feria de Ciencias 2026 · BioPlast Andino</span><span>Página 3</span></div>
</div>

<!-- ════════ PÁGINA 4 ════════ -->
<div class="page">

  <!-- 6. CONCLUSIÓN -->
  <div class="sec">
    <div class="sec-head"><div class="sec-num">6</div><div class="sec-title">Conclusión</div></div>
    <div class="sec-body">
      <p>Logré comprobar mi hipótesis: <strong>sí es posible transformar las cáscaras de papa en un
      bioplástico</strong> flexible, moldeable y biodegradable, usando solo cosas de cocina y una
      transformación química sencilla (almidón + vinagre + glicerina + calor).</p>
      <p>Con este proyecto demostré que <strong>un residuo que botamos todos los días puede convertirse
      en un material útil</strong> que reemplaza al plástico de un solo uso. Es una idea eco-productiva
      porque casi no cuesta dinero, aprovecha la basura orgánica y ayuda a contaminar menos.</p>
      <p>Lo más bonito fue darme cuenta de que la ciencia no está solo en los laboratorios:
      <strong>también está en mi cocina</strong>. Aprendí qué es un polímero, qué hace un plastificante
      y, sobre todo, que con observación y paciencia (¡me salió mal 3 veces!) se pueden resolver
      problemas reales. En el futuro me gustaría mejorar la receta para que el bioplástico sea más
      resistente al agua y poder hacer bolsas o macetas biodegradables de verdad.</p>
      <div class="callout">
        🌱 <strong>Mi mensaje:</strong> si una estudiante de 3.° de secundaria puede hacer plástico
        ecológico con cáscaras de papa, imagínate lo que podemos lograr todos si cuidamos el planeta.
      </div>
    </div>
  </div>

  <!-- 7. ANEXOS -->
  <div class="sec">
    <div class="sec-head"><div class="sec-num">7</div><div class="sec-title">Anexos</div></div>
    <div class="sec-body">

      <p><strong>Anexo A — Tabla de observaciones</strong></p>
      <table>
        <thead><tr><th>Etapa</th><th>¿Qué observé?</th><th>Resultado</th></tr></thead>
        <tbody>
          <tr><td>Mezcla inicial</td><td>Líquido blanco con grumos</td><td>—</td></tr>
          <tr><td>Durante la cocción</td><td>Se volvió un gel transparente y espeso</td><td>✔ Transformación</td></tr>
          <tr><td>Al secar (2–3 días)</td><td>Lámina sólida y flexible</td><td>✔ Bioplástico</td></tr>
          <tr><td>Prueba de doblez</td><td>Se dobla sin romperse</td><td>✔ Flexible</td></tr>
          <tr><td>Enterrado en tierra</td><td>Empieza a deshacerse en pocos días</td><td>✔ Biodegradable</td></tr>
        </tbody>
      </table>

      <p style="margin-top:12px;"><strong>Anexo B — Evidencia fotográfica</strong></p>
      <div class="photo-grid">
        <div><div class="photo-box">📷 Pega aquí tu foto<br/>(materiales)</div><div class="photo-cap">Foto 1: Materiales utilizados</div></div>
        <div><div class="photo-box">📷 Pega aquí tu foto<br/>(cocción del gel)</div><div class="photo-cap">Foto 2: La mezcla volviéndose gel</div></div>
        <div><div class="photo-box">📷 Pega aquí tu foto<br/>(secado)</div><div class="photo-cap">Foto 3: Bioplástico secándose</div></div>
        <div><div class="photo-box">📷 Pega aquí tu foto<br/>(resultado final)</div><div class="photo-cap">Foto 4: Resultado final / maqueta</div></div>
      </div>

      <p style="margin-top:12px;"><strong>Anexo C — Glosario</strong></p>
      <ul>
        <li><strong>Almidón:</strong> sustancia que guardan las plantas como reserva de energía; es un polímero natural.</li>
        <li><strong>Polímero:</strong> material formado por cadenas largas de moléculas repetidas.</li>
        <li><strong>Plastificante:</strong> sustancia (aquí la glicerina) que hace flexible al material.</li>
        <li><strong>Biodegradable:</strong> que la naturaleza puede descomponer en poco tiempo.</li>
      </ul>

      <p style="margin-top:8px;"><strong>Anexo D — Referencias</strong></p>
      <ul>
        <li>Ministerio del Ambiente del Perú (MINAM) — información sobre plásticos de un solo uso.</li>
        <li>Centro Internacional de la Papa (CIP) — la papa en el Perú.</li>
        <li>Experimentos escolares de bioplástico a base de almidón (química básica).</li>
      </ul>
    </div>
  </div>

  <div class="pagefoot"><span>Feria de Ciencias 2026 · BioPlast Andino</span><span>Página 4</span></div>
</div>

</body>
</html>`;

const outDir = path.join(ROOT, 'feria-ciencias');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'feria-ciencias-bioplastico.html');
fs.writeFileSync(outPath, html, 'utf8');
console.log('HTML escrito en:', outPath);
