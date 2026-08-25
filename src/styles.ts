export const CSS = String.raw`
:root{
  --ink:#14203A;
  --ink-soft:#3C4761;
  --muted:#6B7488;
  --ground:#F1F3F6;
  --surface:#FFFFFF;
  --surface-2:#E9ECF1;
  --rail:#2E4A8F;
  --rail-soft:#8FA3CE;
  --accent:#E8622C;
  --accent-soft:#F7DCD0;
  --hairline:#D5DAE2;
  --shadow:0 1px 2px rgba(20,32,58,.06),0 8px 24px -12px rgba(20,32,58,.18);
}
@media (prefers-color-scheme:dark){
  :root:not([data-theme="light"]){
    --ink:#E8ECF3;
    --ink-soft:#BAC3D4;
    --muted:#98A1B5;
    --ground:#10131B;
    --surface:#181C26;
    --surface-2:#212636;
    --rail:#7A9BE0;
    --rail-soft:#3E4E74;
    --accent:#FF7A45;
    --accent-soft:#4A2415;
    --hairline:#2A3040;
    --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6);
  }
}
:root[data-theme="dark"]{
  --ink:#E8ECF3;
  --ink-soft:#BAC3D4;
  --muted:#98A1B5;
  --ground:#10131B;
  --surface:#181C26;
  --surface-2:#212636;
  --rail:#7A9BE0;
  --rail-soft:#3E4E74;
  --accent:#FF7A45;
  --accent-soft:#4A2415;
  --hairline:#2A3040;
  --shadow:0 1px 2px rgba(0,0,0,.4),0 8px 24px -12px rgba(0,0,0,.6);
}

*{box-sizing:border-box}
body{
  margin:0;
  background:var(--ground);
  color:var(--ink);
  font-family:"Newsreader",Georgia,"Times New Roman",serif;
  font-size:17px;
  line-height:1.6;
  -webkit-font-smoothing:antialiased;
}
.wrap{max-width:820px;margin:0 auto;padding:48px 24px 96px}

/* ---------- header ---------- */
.masthead{display:flex;flex-direction:column;gap:18px;margin-bottom:14px}
.eyebrow{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:11.5px;font-weight:500;letter-spacing:.16em;text-transform:uppercase;
  color:var(--accent);margin:0;
}
h1{
  font-family:"Zen Kaku Gothic New","Hiragino Sans","Helvetica Neue",sans-serif;
  font-weight:900;font-size:clamp(42px,8vw,68px);line-height:.98;
  letter-spacing:-.025em;margin:0;text-wrap:balance;color:var(--ink);
}
.standfirst{
  margin:0;max-width:60ch;font-size:18.5px;color:var(--ink-soft);
}
.standfirst em{font-style:italic;color:var(--ink)}

/* route chain */
.route{
  display:flex;flex-wrap:wrap;align-items:center;gap:8px 10px;
  font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;
  font-size:13.5px;font-weight:700;letter-spacing:.01em;
  padding:16px 0;border-top:1px solid var(--hairline);border-bottom:1px solid var(--hairline);
}
.route .stop{color:var(--ink)}
.route .stop.back{color:var(--muted);font-weight:500}
.route .arrow{color:var(--rail-soft);font-size:12px}

/* stats */
.stats{
  display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));
  gap:1px;background:var(--hairline);border:1px solid var(--hairline);
  margin:0 0 56px;border-radius:3px;overflow:hidden;
}
.stat{background:var(--surface);padding:14px 16px;display:flex;flex-direction:column;gap:3px}
.stat dt{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10.5px;letter-spacing:.13em;text-transform:uppercase;color:var(--muted);
}
.stat dd{
  margin:0;font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;
  font-weight:700;font-size:21px;line-height:1.1;color:var(--ink);
  font-variant-numeric:tabular-nums;
}

/* ---------- timeline ---------- */
.timeline{display:grid;grid-template-columns:44px minmax(0,1fr);column-gap:20px}
.entry{display:contents}
.marker{position:relative;display:flex;justify-content:center}
.marker::before{
  content:"";position:absolute;top:0;bottom:0;left:calc(50% - 1px);
  width:2px;background:var(--rail-soft);
}
.entry:first-child .marker::before{top:26px}
.entry:last-child .marker::before{bottom:auto;height:26px}

.dot{
  position:relative;margin-top:16px;width:16px;height:16px;border-radius:50%;
  background:var(--surface);border:2.5px solid var(--rail);flex:none;
}
.dot.arrive{background:var(--accent);border-color:var(--accent);box-shadow:0 0 0 4px var(--accent-soft)}
.dot.end{background:var(--rail);border-color:var(--rail)}

.leg-mark{margin:0;width:2px;flex:none}
.leg-mark .glyph{
  position:relative;margin-top:20px;width:20px;height:20px;margin-left:-9px;
  border-radius:50%;background:var(--ground);
  display:flex;align-items:center;justify-content:center;
  color:var(--rail);font-size:11px;line-height:1;
}

/* day card */
.day{
  background:var(--surface);border:1px solid var(--hairline);border-radius:4px;
  padding:20px 22px 22px;margin-bottom:14px;box-shadow:var(--shadow);
}
.day-head{
  display:flex;flex-wrap:wrap;align-items:baseline;gap:10px 12px;
  padding-bottom:14px;margin-bottom:16px;border-bottom:1px solid var(--hairline);
}
.daynum{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;
  color:var(--muted);font-variant-numeric:tabular-nums;
}
.city{
  font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;
  font-weight:900;font-size:27px;line-height:1;letter-spacing:-.015em;
  margin:0;color:var(--ink);
}
.chip{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;
  padding:3px 8px;border-radius:2px;white-space:nowrap;
}
.chip.arrive{background:var(--accent);color:#FFF}
.chip.stay{background:var(--surface-2);color:var(--ink-soft)}
.chip.out{background:var(--rail);color:#FFF}
.from-note{
  margin-left:auto;font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--rail);
}

/* slot rows */
.slots{display:flex;flex-direction:column;gap:15px}
.slot{display:grid;grid-template-columns:74px minmax(0,1fr);gap:16px;align-items:start}
.slot-label{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10.5px;font-weight:600;letter-spacing:.13em;text-transform:uppercase;
  color:var(--muted);padding-top:5px;
}
.slot-body{margin:0;font-size:16.5px;color:var(--ink-soft)}
.slot-body strong{color:var(--ink);font-weight:600}
.slot-body .sub{
  display:block;margin-top:4px;font-size:14.5px;color:var(--muted);
}
.slot-body .alt{
  display:block;margin-top:6px;padding-left:11px;border-left:2px solid var(--hairline);
  font-size:14.5px;color:var(--muted);
}
.mono{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:.88em;font-variant-numeric:tabular-nums}

/* leg */
.leg{
  margin:0 0 14px;padding:13px 18px;
  border:1px dashed var(--rail-soft);border-radius:4px;background:transparent;
  display:flex;flex-wrap:wrap;align-items:baseline;gap:6px 18px;
}
.leg-title{
  font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;
  font-weight:700;font-size:14.5px;color:var(--rail);letter-spacing:.01em;
}
.leg-meta{
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12.5px;
  color:var(--muted);font-variant-numeric:tabular-nums;
}
.leg-note{flex-basis:100%;font-size:14.5px;color:var(--ink-soft);margin:2px 0 0}
.leg-note b,.leg-note strong{color:var(--accent);font-weight:600}

/* ---------- notes ---------- */
.notes{margin-top:64px;padding-top:36px;border-top:2px solid var(--ink)}
h2{
  font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;
  font-weight:900;font-size:15px;letter-spacing:.1em;text-transform:uppercase;
  margin:0 0 22px;color:var(--ink);
}
.note-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:26px}
.note h3{
  font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;
  font-weight:700;font-size:16px;margin:0 0 7px;color:var(--ink);letter-spacing:-.005em;
}
.note p{margin:0 0 9px;font-size:15.5px;color:var(--ink-soft)}
.note p:last-child{margin-bottom:0}
.note b,.note strong{color:var(--ink);font-weight:600}

.fares{width:100%;border-collapse:collapse;margin-top:4px;font-size:14.5px}
.fares th,.fares td{text-align:left;padding:6px 10px 6px 0;border-bottom:1px solid var(--hairline)}
.fares th{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted);font-weight:600;
}
.fares td:last-child,.fares th:last-child{text-align:right;padding-right:0}
.fares td.num{font-family:"IBM Plex Mono",ui-monospace,monospace;font-variant-numeric:tabular-nums;color:var(--ink)}
.fares tr.total td{border-bottom:none;padding-top:9px;font-weight:600;color:var(--ink)}
.table-scroll{overflow-x:auto}

.caveat{
  margin-top:44px;padding:16px 18px;border-left:3px solid var(--accent);
  background:var(--surface);border-radius:0 4px 4px 0;
}
.caveat p{margin:0;font-size:15px;color:var(--ink-soft)}
.caveat b,.caveat strong{color:var(--ink);font-weight:600}

@media (max-width:640px){
  .wrap{padding:36px 16px 72px}
  .timeline{grid-template-columns:28px minmax(0,1fr);column-gap:14px}
  .day{padding:17px 17px 19px}
  .slot{grid-template-columns:1fr;gap:3px}
  .slot-label{padding-top:0}
  .from-note{margin-left:0;flex-basis:100%}
}

/* photos */
.shots{display:flex;flex-direction:column;gap:12px;margin:0 0 18px}
.shot{margin:0;position:relative}
.shot img{
  display:block;width:100%;aspect-ratio:3/2;object-fit:cover;
  border-radius:3px;background:var(--surface-2);
}
.shot figcaption{
  margin-top:6px;font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10px;letter-spacing:.06em;color:var(--muted);line-height:1.6;
}
.shot figcaption a{color:var(--muted);text-decoration:underline;text-underline-offset:2px}
.shot figcaption a:hover{color:var(--accent)}
.cap-alt{display:block;color:var(--ink-soft)}
.shot-del{
  position:absolute;top:8px;right:8px;width:26px;height:26px;border-radius:50%;
  cursor:pointer;font-size:15px;line-height:1;
  background:var(--surface);color:var(--ink-soft);border:1px solid var(--hairline);
}
.shot-del:hover{background:#c0392b;color:#fff;border-color:#c0392b}
.shot-add{
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;
  letter-spacing:.1em;text-transform:uppercase;padding:7px 10px;border-radius:2px;cursor:pointer;
  background:transparent;color:var(--muted);border:1px dashed var(--hairline);
}
.shot-add:hover{color:var(--accent);border-color:var(--accent)}

/* -------------------------------------------------------------- index --- */
.index .masthead{margin-bottom:40px}
.trip-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px}
.trip-card{
  display:flex;flex-direction:column;gap:5px;
  padding:18px 20px 20px;text-decoration:none;
  background:var(--surface);border:1px solid var(--hairline);border-radius:4px;
  box-shadow:var(--shadow);transition:border-color .13s,transform .13s;
}
.trip-card:hover{border-color:var(--accent);transform:translateY(-1px)}
.trip-card:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.trip-name{
  font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;
  font-weight:900;font-size:21px;line-height:1.15;letter-spacing:-.015em;color:var(--ink);
}
.trip-meta{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--accent);
}
.trip-date{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10.5px;letter-spacing:.06em;color:var(--muted);margin-top:auto;padding-top:8px;
}
.empty{grid-column:1/-1;color:var(--muted);margin:0}
.trip-new{
  display:flex;flex-direction:column;gap:9px;padding:18px 20px 20px;
  border:1px dashed var(--hairline);border-radius:4px;background:transparent;
}
.new-label{
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10.5px;letter-spacing:.11em;text-transform:uppercase;color:var(--muted);
}
.trip-new input{
  font:inherit;font-size:15px;padding:8px 10px;border-radius:3px;
  background:var(--ground);color:var(--ink);border:1px solid var(--hairline);
}
.trip-new input:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:transparent}
.trip-new .btn{margin-top:2px;text-align:center}

/* back link on a trip page */
.trip-back{
  display:inline-flex;align-items:center;gap:6px;margin-bottom:22px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:10.5px;letter-spacing:.11em;text-transform:uppercase;
  color:var(--muted);text-decoration:none;
}
.trip-back:hover{color:var(--accent)}

/* --------------------------------------------------------------- chat --- */
.chat-launch{
  position:fixed;right:16px;bottom:16px;z-index:40;
  width:46px;height:46px;border-radius:50%;cursor:pointer;
  display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;
  background:var(--accent);color:#fff;border:none;
  box-shadow:0 2px 6px rgba(20,32,58,.18),0 10px 26px -10px rgba(20,32,58,.4);
}
.chat-launch:hover{filter:brightness(1.07)}
.chat-launch:focus-visible{outline:2px solid var(--rail);outline-offset:3px}

.chat-dock{
  position:fixed;right:0;top:0;bottom:0;z-index:41;width:min(420px,100vw);
  display:flex;flex-direction:column;
  background:var(--surface);border-left:1px solid var(--hairline);
  box-shadow:-14px 0 40px -22px rgba(20,32,58,.5);
}
.chat-head{
  display:flex;align-items:center;justify-content:space-between;gap:12px;
  padding:14px 16px;border-bottom:1px solid var(--hairline);
}
.chat-title{
  font-family:"Zen Kaku Gothic New","Hiragino Sans",sans-serif;
  font-weight:700;font-size:14px;letter-spacing:.01em;color:var(--ink);
}
.chat-close{
  width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:17px;line-height:1;
  background:transparent;color:var(--muted);border:1px solid transparent;
}
.chat-close:hover{color:var(--ink);border-color:var(--hairline)}

.chat-log{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:11px}
.bubble{
  max-width:88%;padding:9px 13px;border-radius:4px;font-size:15px;line-height:1.55;
  white-space:pre-wrap;overflow-wrap:anywhere;
}
.bubble.me{align-self:flex-end;background:var(--rail);color:#fff}
.bubble.bot{align-self:flex-start;background:var(--surface-2);color:var(--ink)}
.bubble.note{
  align-self:stretch;max-width:none;background:transparent;color:var(--muted);
  border:1px dashed var(--hairline);font-size:13.5px;
}
.tool-line{
  align-self:flex-start;font-family:"IBM Plex Mono",ui-monospace,monospace;
  font-size:11px;letter-spacing:.05em;color:var(--accent);
  padding-left:11px;border-left:2px solid var(--accent);
}
.chat-status{
  padding:0 16px;min-height:18px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;
  letter-spacing:.07em;color:var(--muted);
}
.chat-form{display:flex;gap:8px;align-items:flex-end;padding:12px 16px 16px}
.chat-form textarea{
  flex:1;resize:none;font:inherit;font-size:15px;line-height:1.5;
  padding:9px 11px;border-radius:4px;
  background:var(--ground);color:var(--ink);border:1px solid var(--hairline);
}
.chat-form textarea:focus{outline:2px solid var(--accent);outline-offset:-1px;border-color:transparent}
.chat-send{
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11px;
  letter-spacing:.09em;text-transform:uppercase;padding:10px 13px;border-radius:3px;
  cursor:pointer;background:var(--accent);color:#fff;border:none;
}
.chat-send:hover:not(:disabled){filter:brightness(1.07)}
.chat-send:disabled{opacity:.45;cursor:default}
body.chat-open .chat-launch{display:none}

@media (max-width:640px){
  .chat-dock{width:100vw}
}
@media print{.chat-launch,.chat-dock{display:none}}

/* ------------------------------------------------------------- editor --- */
.toolbar{
  position:sticky;top:0;z-index:20;margin:-48px -24px 34px;padding:11px 24px;
  display:flex;flex-wrap:wrap;align-items:center;gap:10px;
  background:var(--surface);border-bottom:1px solid var(--hairline);
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:12px;
}
.toolbar .spacer{flex:1}
.btn{
  font:inherit;font-size:11.5px;letter-spacing:.06em;text-transform:uppercase;
  padding:6px 11px;border-radius:3px;cursor:pointer;
  background:var(--surface-2);color:var(--ink-soft);border:1px solid var(--hairline);
}
.btn:hover{color:var(--ink);border-color:var(--rail-soft)}
.btn:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.danger:hover{background:#c0392b;border-color:#c0392b;color:#fff}
.btn.primary:hover{color:#fff;filter:brightness(1.07)}
.status{color:var(--muted);font-size:11.5px;letter-spacing:.06em;min-width:8ch}
.status.saving{color:var(--rail)}
.status.saved{color:var(--accent)}
.status.error{color:#c0392b}

.legend{
  margin:-14px 0 30px;padding:11px 14px;border:1px dashed var(--hairline);border-radius:4px;
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:11.5px;line-height:1.9;
  color:var(--muted);display:flex;flex-wrap:wrap;gap:4px 20px;
}
.legend b{color:var(--ink-soft);font-weight:600}

.ed{
  border-radius:2px;outline:1px dashed var(--rail-soft);outline-offset:3px;
  min-width:1.5ch;display:inline-block;
}
.ed.block{display:block;white-space:pre-wrap}
.ed:hover{outline-color:var(--rail);background:var(--surface-2)}
.ed:focus{outline:2px solid var(--accent);outline-offset:3px;background:var(--surface-2)}
.editing .slot-body,.editing .leg-note,.editing .standfirst{font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:13.5px;line-height:1.75}

.editing .day,.editing .leg,.editing .note{position:relative}
.ctl{
  position:absolute;top:-11px;right:10px;display:flex;gap:4px;
  opacity:0;transition:opacity .12s;
}
.editing .day:hover .ctl,.editing .leg:hover .ctl,.editing .note:hover .ctl,.ctl:focus-within{opacity:1}
.ctl button{
  font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.05em;
  padding:3px 7px;border-radius:2px;cursor:pointer;
  background:var(--surface);color:var(--ink-soft);border:1px solid var(--hairline);
}
.ctl button:hover{color:var(--ink);border-color:var(--rail)}
.ctl button.danger:hover{color:#fff;background:#c0392b;border-color:#c0392b}
.note-ctl{top:-6px;right:0}

.slot-add{
  margin-top:14px;font-family:"IBM Plex Mono",ui-monospace,monospace;font-size:10.5px;
  letter-spacing:.1em;text-transform:uppercase;padding:5px 10px;border-radius:2px;cursor:pointer;
  background:transparent;color:var(--muted);border:1px dashed var(--hairline);
}
.slot-add:hover{color:var(--accent);border-color:var(--accent)}
.slot-del{
  float:right;margin-left:8px;font-size:13px;line-height:1;padding:2px 6px;cursor:pointer;
  background:transparent;color:var(--muted);border:1px solid transparent;border-radius:2px;
}
.slot-del:hover{color:#fff;background:#c0392b}

@media (max-width:640px){
  .toolbar{margin:-36px -16px 26px;padding:10px 16px}
}
@media (prefers-reduced-motion:reduce){.ctl{transition:none}}
@media print{.toolbar,.ctl,.slot-add,.slot-del,.legend,.shot-add,.shot-del{display:none}}
.shot img{break-inside:avoid}
`;
