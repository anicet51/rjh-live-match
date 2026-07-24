import React, { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";

const STORAGE_KEY = "rjh-live-match-state-v1";

const EVENT_TYPES = [
  { type: "goal", label: "But" },
  { type: "yellow", label: "Carton jaune" },
  { type: "red", label: "Carton rouge" },
  { type: "sub", label: "Remplacement" },
  { type: "half", label: "Mi-temps" },
  { type: "end", label: "Fin de match" },
];

const defaultState = {
  homeTeam: "Domicile",
  awayTeam: "Extérieur",
  homeLogo: "",
  awayLogo: "",
  homeScore: 0,
  awayScore: 0,
  minute: 0,
  events: [],
};

function loadSavedState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
  } catch {
    return defaultState;
  }
}

function formatMinute(minute) {
  return `${Math.max(0, minute)}'`;
}

function createEventId() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function waitForPaint() {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

function getInitials(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

function fileToLogoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);

    image.onload = () => {
      const maxSize = 512;
      const ratio = Math.min(maxSize / image.width, maxSize / image.height, 1);
      const width = Math.round(image.width * ratio);
      const height = Math.round(image.height * ratio);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, width, height);
      URL.revokeObjectURL(objectUrl);
      resolve(canvas.toDataURL("image/png"));
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Logo illisible"));
    };

    image.src = objectUrl;
  });
}

function App() {
  const [match, setMatch] = useState(loadSavedState);
  const [side, setSide] = useState("home");
  const [eventPlayer, setEventPlayer] = useState("");
  const [eventComment, setEventComment] = useState("");
  const [exporting, setExporting] = useState("");
  const [exportPreview, setExportPreview] = useState(null);
  const [exportMessage, setExportMessage] = useState("");
  const exportRef = useRef(null);
  const historyExportRef = useRef(null);

  const latestEvents = useMemo(() => match.events.slice(0, 5), [match.events]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(match));
    } catch {
      // Safari can reject localStorage in a few privacy/storage edge cases.
    }
  }, [match]);

  useEffect(() => {
    return () => {
      if (exportPreview?.url) {
        URL.revokeObjectURL(exportPreview.url);
      }
    };
  }, [exportPreview]);

  function updateField(field, value) {
    setMatch((current) => ({ ...current, [field]: value }));
  }

  async function updateLogo(team, file) {
    if (!file) return;
    const dataUrl = await fileToLogoDataUrl(file);
    updateField(team === "home" ? "homeLogo" : "awayLogo", dataUrl);
  }

  function changeScore(team, delta) {
    const key = team === "home" ? "homeScore" : "awayScore";
    setMatch((current) => ({ ...current, [key]: Math.max(0, current[key] + delta) }));
  }

  function changeMinute(delta) {
    setMatch((current) => ({ ...current, minute: Math.max(0, current.minute + delta) }));
  }

  function addEvent(eventType) {
    const config = EVENT_TYPES.find((event) => event.type === eventType);
    const isGoal = eventType === "goal";
    const teamName = side === "home" ? match.homeTeam : match.awayTeam;
    const title = isGoal ? `But ${teamName}` : config.label;
    const player = eventPlayer.trim();
    const comment = eventComment.trim();

    setMatch((current) => {
      const next = { ...current };
      if (isGoal) {
        const scoreKey = side === "home" ? "homeScore" : "awayScore";
        next[scoreKey] = next[scoreKey] + 1;
      }

      next.events = [
        {
          id: createEventId(),
          type: eventType,
          label: title,
          team: side,
          player,
          comment,
          minute: current.minute,
          homeScore: isGoal && side === "home" ? current.homeScore + 1 : current.homeScore,
          awayScore: isGoal && side === "away" ? current.awayScore + 1 : current.awayScore,
          createdAt: Date.now(),
        },
        ...current.events,
      ];

      return next;
    });

    setEventPlayer("");
    setEventComment("");
  }

  function deleteEvent(id) {
    setMatch((current) => {
      const event = current.events.find((item) => item.id === id);
      const next = { ...current, events: current.events.filter((item) => item.id !== id) };

      if (event?.type === "goal") {
        const scoreKey = event.team === "home" ? "homeScore" : "awayScore";
        next[scoreKey] = Math.max(0, next[scoreKey] - 1);
      }

      return next;
    });
  }

  function resetMatch() {
    setMatch(defaultState);
    setSide("home");
    setEventPlayer("");
    setEventComment("");
  }

  function createExportFilename(suffix) {
    return `rjh-live-${match.homeTeam}-${match.awayTeam}-${suffix}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  function closeExportPreview() {
    setExportPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return null;
    });
    setExportMessage("");
  }

  function canvasToBlob(canvas) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Image impossible à créer"));
        }
      }, "image/png");
    });
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.download = filename;
    link.href = url;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function shareFile(file) {
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: "RJH Live Match",
        text: `${match.homeTeam} ${match.homeScore} - ${match.awayScore} ${match.awayTeam} (${formatMinute(match.minute)})`,
      });
      return true;
    }

    return false;
  }

  async function exportCanvas(canvas, suffix) {
    const filename = `${createExportFilename(suffix)}.png`;
    const blob = await canvasToBlob(canvas);
    const file = new File([blob], filename, { type: "image/png" });
    const url = URL.createObjectURL(blob);

    setExportPreview((current) => {
      if (current?.url) {
        URL.revokeObjectURL(current.url);
      }
      return { file, filename, url };
    });

    try {
      const shared = await shareFile(file);
      setExportMessage(
        shared
          ? "Le partage est ouvert. Choisis WhatsApp si tu veux l'envoyer directement."
          : "Image prête. Sur iPhone, garde le doigt sur l'image pour l'enregistrer ou la partager.",
      );
    } catch (error) {
      setExportMessage(
        error?.name === "AbortError"
          ? "Partage annulé. L'image reste disponible ci-dessous."
          : "Image prête. Sur iPhone, garde le doigt sur l'image pour l'enregistrer ou la partager.",
      );
    }

    if (!navigator.canShare?.({ files: [file] })) {
      downloadBlob(blob, filename);
    }
  }

  async function exportImage() {
    if (!exportRef.current) return;
    setExporting("square");
    setExportMessage("");

    await waitForPaint();
    const canvas = await html2canvas(exportRef.current, {
      width: 1080,
      height: 1080,
      windowWidth: 1080,
      windowHeight: 1080,
      scale: 1,
      backgroundColor: "#f7f8fc",
      useCORS: true,
    });

    await exportCanvas(canvas, "whatsapp");
    setExporting("");
  }

  async function exportFullHistory() {
    if (!historyExportRef.current) return;
    setExporting("history");
    setExportMessage("");

    await waitForPaint();
    const height = historyExportRef.current.scrollHeight;
    const canvas = await html2canvas(historyExportRef.current, {
      width: 1080,
      height,
      windowWidth: 1080,
      windowHeight: height,
      scale: 1,
      backgroundColor: "#f7f8fc",
      useCORS: true,
    });

    await exportCanvas(canvas, "historique-complet");
    setExporting("");
  }

  return (
    <main className="app-shell">
      <section className="topbar">
        <div>
          <p className="eyebrow">RJH Live Match</p>
          <h1>Suivi du match</h1>
        </div>
        <span className="signature">Anicet51</span>
      </section>

      <section className="logo-card priority-logo-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Avant match</p>
            <h2>Ajouter les logos</h2>
          </div>
        </div>
        <div className="logo-manager-grid">
          <ClubLogoControl
            label="Logo domicile"
            name={match.homeTeam}
            logo={match.homeLogo}
            onLogoChange={(file) => updateLogo("home", file)}
            onLogoRemove={() => updateField("homeLogo", "")}
          />
          <ClubLogoControl
            label="Logo extérieur"
            name={match.awayTeam}
            logo={match.awayLogo}
            onLogoChange={(file) => updateLogo("away", file)}
            onLogoRemove={() => updateField("awayLogo", "")}
          />
        </div>
      </section>

      <section className="scoreboard" aria-label="Score du match">
        <TeamPanel
          label="Domicile"
          name={match.homeTeam}
          logo={match.homeLogo}
          score={match.homeScore}
          active={side === "home"}
          onNameChange={(value) => updateField("homeTeam", value)}
          onLogoChange={(file) => updateLogo("home", file)}
          onLogoRemove={() => updateField("homeLogo", "")}
          onSelect={() => setSide("home")}
          onScoreMinus={() => changeScore("home", -1)}
          onScorePlus={() => changeScore("home", 1)}
        />

        <div className="match-clock">
          <span>Minute</span>
          <strong>{formatMinute(match.minute)}</strong>
          <div className="minute-controls">
            <button type="button" onClick={() => changeMinute(-1)} aria-label="Retirer une minute">
              -1
            </button>
            <button type="button" onClick={() => changeMinute(1)} aria-label="Ajouter une minute">
              +1
            </button>
          </div>
        </div>

        <TeamPanel
          label="Extérieur"
          name={match.awayTeam}
          logo={match.awayLogo}
          score={match.awayScore}
          active={side === "away"}
          onNameChange={(value) => updateField("awayTeam", value)}
          onLogoChange={(file) => updateLogo("away", file)}
          onLogoRemove={() => updateField("awayLogo", "")}
          onSelect={() => setSide("away")}
          onScoreMinus={() => changeScore("away", -1)}
          onScorePlus={() => changeScore("away", 1)}
        />
      </section>

      <section className="event-card">
        <div className="section-title">
          <div>
            <p className="eyebrow">Événement pour</p>
            <h2>{side === "home" ? match.homeTeam : match.awayTeam}</h2>
          </div>
          <div className="side-switch" role="group" aria-label="Choix de l'équipe">
            <button type="button" className={side === "home" ? "active" : ""} onClick={() => setSide("home")}>
              Dom.
            </button>
            <button type="button" className={side === "away" ? "active" : ""} onClick={() => setSide("away")}>
              Ext.
            </button>
          </div>
        </div>

        <div className="event-details">
          <label>
            Joueur
            <input
              value={eventPlayer}
              onChange={(event) => setEventPlayer(event.target.value)}
              placeholder="Nom du joueur"
              type="text"
            />
          </label>
          <label>
            Commentaire
            <textarea
              value={eventComment}
              onChange={(event) => setEventComment(event.target.value)}
              placeholder="Court commentaire"
              rows="2"
            />
          </label>
        </div>

        <div className="event-grid">
          {EVENT_TYPES.map((event) => (
            <button key={event.type} type="button" className={`event-button ${event.type}`} onClick={() => addEvent(event.type)}>
              <EventPictogram type={event.type} />
              {event.label}
            </button>
          ))}
        </div>
      </section>

      <section className="timeline">
        <div className="section-title">
          <div>
            <p className="eyebrow">Direct</p>
            <h2>Timeline</h2>
          </div>
          <button type="button" className="ghost-button" onClick={resetMatch}>
            Réinitialiser
          </button>
        </div>

        {match.events.length === 0 ? (
          <p className="empty-state">Aucun événement pour le moment.</p>
        ) : (
          <ol>
            {match.events.map((event) => (
              <li key={event.id} className="timeline-item">
                <div className="event-minute">{formatMinute(event.minute)}</div>
                <div className="event-text">
                  <strong>
                    <EventPictogram type={event.type} /> {event.label}
                  </strong>
                  <span>
                    {event.homeScore} - {event.awayScore}
                  </span>
                  {event.player && <span className="event-detail-line">Joueur : {event.player}</span>}
                  {event.comment && <span className="event-detail-line">{event.comment}</span>}
                </div>
                <button type="button" onClick={() => deleteEvent(event.id)} aria-label={`Supprimer ${event.label}`}>
                  ×
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="export-actions">
        <button type="button" className="export-button" onClick={exportImage} disabled={Boolean(exporting)}>
          {exporting === "square" ? "Création..." : "Exporter carré WhatsApp"}
        </button>
        <button type="button" className="history-button" onClick={exportFullHistory} disabled={Boolean(exporting)}>
          {exporting === "history" ? "Création..." : "Exporter tous les événements"}
        </button>
      </section>

      {exportPreview && (
        <section className="export-preview" aria-label="Image exportée">
          <div className="section-title">
            <div>
              <p className="eyebrow">Export</p>
              <h2>Image prête</h2>
            </div>
            <button type="button" className="ghost-button" onClick={closeExportPreview}>
              Fermer
            </button>
          </div>
          {exportMessage && <p className="preview-message">{exportMessage}</p>}
          <img src={exportPreview.url} alt="Visuel RJH Live Match à partager" />
          <div className="preview-actions">
            <button type="button" onClick={() => shareFile(exportPreview.file)}>
              Partager
            </button>
            <button type="button" onClick={() => downloadBlob(exportPreview.file, exportPreview.filename)}>
              Télécharger
            </button>
          </div>
        </section>
      )}

      <div className={`export-stage ${exporting ? "active" : ""}`} aria-hidden="true">
        <div className={`share-card ${exporting === "square" ? "render-target" : ""}`} ref={exportRef}>
          <div className="share-header">
            <span>RJH Live Match</span>
            <small>Anicet51</small>
          </div>
          <div className="share-score">
            <div>
              <LogoMark logo={match.homeLogo} name={match.homeTeam} size="large" />
              <span>{match.homeTeam}</span>
              <strong>{match.homeScore}</strong>
            </div>
            <em>{formatMinute(match.minute)}</em>
            <div>
              <LogoMark logo={match.awayLogo} name={match.awayTeam} size="large" />
              <span>{match.awayTeam}</span>
              <strong>{match.awayScore}</strong>
            </div>
          </div>
          <div className="share-events">
            <h3>5 derniers événements</h3>
            {latestEvents.length === 0 ? (
              <p>Match prêt à démarrer.</p>
            ) : (
              latestEvents.map((event) => (
                <p key={event.id}>
                  <b>{formatMinute(event.minute)}</b>
                  <span>
                    <EventPictogram type={event.type} /> {event.label}
                    {event.player ? ` - ${event.player}` : ""}
                  </span>
                </p>
              ))
            )}
          </div>
        </div>

        <div className={`history-card ${exporting === "history" ? "render-target" : ""}`} ref={historyExportRef}>
          <div className="share-header">
            <span>RJH Live Match</span>
            <small>Anicet51</small>
          </div>
          <div className="history-score">
            <LogoMark logo={match.homeLogo} name={match.homeTeam} size="export" />
            <strong>
              {match.homeTeam} {match.homeScore} - {match.awayScore} {match.awayTeam}
            </strong>
            <LogoMark logo={match.awayLogo} name={match.awayTeam} size="export" />
            <em>{formatMinute(match.minute)}</em>
          </div>
          <div className="history-events">
            <h3>Tous les événements</h3>
            {match.events.length === 0 ? (
              <p>Match prêt à démarrer.</p>
            ) : (
              match.events.map((event) => (
                <p key={event.id}>
                  <b>{formatMinute(event.minute)}</b>
                  <span>
                    <EventPictogram type={event.type} /> {event.label}
                    {event.player ? ` - ${event.player}` : ""}
                    {event.comment ? ` (${event.comment})` : ""}
                  </span>
                  <small>
                    {event.homeScore} - {event.awayScore}
                  </small>
                </p>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

function TeamPanel({
  label,
  name,
  logo,
  score,
  active,
  onNameChange,
  onLogoChange,
  onLogoRemove,
  onSelect,
  onScoreMinus,
  onScorePlus,
}) {
  return (
    <article className={`team-panel ${active ? "active" : ""}`}>
      <button type="button" className="team-select" onClick={onSelect}>
        <LogoMark logo={logo} name={name} />
        <span>{label}</span>
        <strong>{score}</strong>
      </button>
      <input value={name} onChange={(event) => onNameChange(event.target.value)} aria-label={`Nom équipe ${label}`} />
      <div className="logo-actions">
        <label>
          {logo ? "Changer logo" : "Ajouter logo"}
          <input type="file" accept="image/*" onChange={(event) => onLogoChange(event.target.files?.[0])} />
        </label>
        <button type="button" onClick={onLogoRemove} disabled={!logo}>
          Retirer
        </button>
      </div>
      <div className="score-controls">
        <button type="button" onClick={onScoreMinus} aria-label={`Retirer un but ${label}`}>
          -1
        </button>
        <button type="button" onClick={onScorePlus} aria-label={`Ajouter un but ${label}`}>
          +1
        </button>
      </div>
    </article>
  );
}

function ClubLogoControl({ label, name, logo, onLogoChange, onLogoRemove }) {
  return (
    <article className="club-logo-control">
      <LogoMark logo={logo} name={name} />
      <div>
        <span>{label}</span>
        <strong>{name}</strong>
      </div>
      <label>
        {logo ? "Changer logo" : "Ajouter logo"}
        <input type="file" accept="image/*" onChange={(event) => onLogoChange(event.target.files?.[0])} />
      </label>
      <button type="button" onClick={onLogoRemove} disabled={!logo}>
        Retirer
      </button>
    </article>
  );
}

function LogoMark({ logo, name, size = "normal" }) {
  return (
    <span className={`club-logo ${size}`}>
      {logo ? <img src={logo} alt="" /> : <span>{getInitials(name) || "FC"}</span>}
    </span>
  );
}

function EventPictogram({ type }) {
  return (
    <svg className={`picto ${type}`} viewBox="0 0 24 24" aria-hidden="true">
      {type === "goal" && (
        <>
          <circle cx="12" cy="12" r="9" fill="#ffffff" stroke="#121826" strokeWidth="1.8" />
          <path d="M12 6.8 15.8 9.6 14.3 14.1H9.7L8.2 9.6 12 6.8Z" fill="#121826" stroke="#121826" strokeWidth="1" />
          <path d="m8.2 9.6-3.4-.9M15.8 9.6l3.4-.9M9.7 14.1l-2.1 3.3M14.3 14.1l2.1 3.3M12 6.8V3.2" stroke="#121826" strokeWidth="1.6" />
        </>
      )}
      {type === "yellow" && <rect x="7.1" y="3.2" width="9.8" height="17.6" rx="1.8" fill="#ffd84d" stroke="#6f5200" strokeWidth="1.7" />}
      {type === "red" && <rect x="7.1" y="3.2" width="9.8" height="17.6" rx="1.8" fill="#d71920" stroke="#ffffff" strokeWidth="1.7" />}
      {type === "sub" && (
        <>
          <path d="M7 7h10l-3-3" />
          <path d="M17 17H7l3 3" />
        </>
      )}
      {type === "half" && (
        <>
          <rect x="7" y="5" width="3.5" height="14" rx="1.2" />
          <rect x="13.5" y="5" width="3.5" height="14" rx="1.2" />
        </>
      )}
      {type === "end" && <rect x="6" y="6" width="12" height="12" rx="2" />}
    </svg>
  );
}

export default App;
