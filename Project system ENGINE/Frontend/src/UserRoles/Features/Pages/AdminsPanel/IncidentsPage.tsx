import React, { useState } from "react";

export const IncidentsPage: React.FC = () => {
  const [query, setQuery] = useState("");
  const [verified, setVerified] = useState(false);
  const [allocatedUnits, setAllocatedUnits] = useState<{ [key: string]: boolean }>({});
  const [activeCategory, setActiveCategory] = useState("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const incidentsList = [
    { id: "INC-2023-889", type: "Vehicle Fire", category: "fire", time: "10 mins ago", status: "active", statusLabel: "Active" },
    { id: "INC-2023-888", type: "Medical Emergency", category: "medical", time: "25 mins ago", status: "enroute", statusLabel: "En Route" },
    { id: "INC-2023-887", type: "Traffic Obstruction", category: "police", time: "1 hour ago", status: "dispatched", statusLabel: "Dispatched" },
    { id: "INC-2023-886", type: "Structural Hazard", category: "other", time: "2 hours ago", status: "resolved", statusLabel: "Resolved" }
  ];

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    showToast(query ? `Searching for "${query}"...` : "Enter an incident ID, type, or timestamp to search.");
  };

  const toggleUnit = (unit: string) => {
    const nextState = !allocatedUnits[unit];
    setAllocatedUnits({ ...allocatedUnits, [unit]: nextState });
    showToast(`${unit} ${nextState ? "allocated to" : "removed from"} INC-2023-889.`);
  };

  const filteredIncidents = incidentsList.filter(inc => {
    if (activeCategory !== "all" && inc.category !== activeCategory) return false;
    if (!query) return true;
    return `${inc.id} ${inc.type} ${inc.time}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="dash">
      <main className="incboard" aria-label="Incident command board">
        <div className="board">
          <div className="board__head" style={{ marginBottom: "16px", display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
            <div className="filters" style={{ display: "flex", gap: "8px" }}>
              <button 
                type="button" 
                className={`filter-btn ${activeCategory === "all" ? "is-active" : ""}`} 
                onClick={() => setActiveCategory("all")}
              >
                All
              </button>
              <button 
                type="button" 
                id="i-medical" 
                className={`filter-btn ${activeCategory === "medical" ? "is-active" : ""}`} 
                onClick={() => setActiveCategory("medical")}
              >
                Medical
              </button>
              <button 
                type="button" 
                id="i-flame" 
                className={`filter-btn ${activeCategory === "fire" ? "is-active" : ""}`} 
                onClick={() => setActiveCategory("fire")}
              >
                Fire
              </button>
              <button 
                type="button" 
                id="i-shield" 
                className={`filter-btn ${activeCategory === "police" ? "is-active" : ""}`} 
                onClick={() => setActiveCategory("police")}
              >
                Police
              </button>
              <button 
                type="button" 
                className={`filter-btn ${activeCategory === "other" ? "is-active" : ""}`} 
                onClick={() => setActiveCategory("other")}
              >
                Other
              </button>
            </div>
          </div>

          <div className="board__grid">
            <section className="card card--feed" aria-labelledby="feed-title">
              <header className="card__head">
                <svg className="card__icon" aria-hidden="true"><use href="#i-image" /></svg>
                <h2 className="card__title" id="feed-title">Received Image or Videos</h2>
                <span className="card__meta">Live feed A-1</span>
              </header>
              <div className="feed">
                <img 
                  className="feed__img" 
                  src="img/incident-feed.png" 
                  alt="Live feed: vehicle fire with severe impact detected" 
                  draggable="false" 
                />
                <button 
                  className="feed__hotspot" 
                  type="button" 
                  id="btn-respond" 
                  aria-label="Respond to victim" 
                  onClick={() => showToast("Dispatch request sent for INC-2023-889 — nearest units are being notified.")}
                />
              </div>
            </section>

            <div className="board__col">
              <section className="card card--location" aria-labelledby="loc-title">
                <header className="card__head">
                  <svg className="card__icon" aria-hidden="true"><use href="#i-crosshair" /></svg>
                  <h2 className="card__title" id="loc-title">Location Information</h2>
                  <span className="loc__lock">GPS_LOCK</span>
                </header>
                <div className="loc">
                  <img 
                    className="loc__thumb" 
                    src="img/location-thumb.png" 
                    alt="Map thumbnail of Brgy. New Tambo, Katipunan, Zamboanga del Norte" 
                  />
                  <div className="loc__info">
                    <p className="loc__label">Coordinates</p>
                    <p className="loc__coords">8.5861° N,<br />123.3364° E</p>
                    <p className="loc__label loc__label--gap">Address</p>
                    <p className="loc__address">Brgy. New Tambo, Katipunan<br />Zamboanga del Norte</p>
                  </div>
                </div>
              </section>

              <section className="card card--alloc" aria-labelledby="alloc-title">
                <header className="card__head">
                  <svg className="card__icon" aria-hidden="true"><use href="#i-shield" /></svg>
                  <h2 className="card__title" id="alloc-title">Responder Allocation</h2>
                </header>
                <div className="units" role="group" aria-label="Responder allocation">
                  <button 
                    className={`unit ${allocatedUnits["PNP"] ? "is-active" : ""}`} 
                    type="button" 
                    data-unit="PNP" 
                    data-role="Traffic/Sec" 
                    aria-pressed={allocatedUnits["PNP"] ? "true" : "false"} 
                    onClick={() => toggleUnit("PNP")}
                  >
                    <svg className="unit__icon" aria-hidden="true"><use href="#i-shield" /></svg>
                    <span className="unit__name">PNP</span>
                    <span className="unit__role">Traffic/Sec</span>
                  </button>
                  <button 
                    className={`unit ${allocatedUnits["BFP"] ? "is-active" : ""}`} 
                    type="button" 
                    data-unit="BFP" 
                    data-role="Fire/Rescue" 
                    aria-pressed={allocatedUnits["BFP"] ? "true" : "false"} 
                    onClick={() => toggleUnit("BFP")}
                  >
                    <svg className="unit__icon" aria-hidden="true"><use href="#i-flame" /></svg>
                    <span className="unit__name">BFP</span>
                    <span className="unit__role">Fire/Rescue</span>
                  </button>
                  <button 
                    className={`unit ${allocatedUnits["RHU"] ? "is-active" : ""}`} 
                    type="button" 
                    data-unit="RHU" 
                    data-role="Medical" 
                    aria-pressed={allocatedUnits["RHU"] ? "true" : "false"} 
                    onClick={() => toggleUnit("RHU")}
                  >
                    <svg className="unit__icon" aria-hidden="true"><use href="#i-medical" /></svg>
                    <span className="unit__name">RHU</span>
                    <span className="unit__role">Medical</span>
                  </button>
                </div>
                <button 
                  className={`btn-verify ${verified ? "is-verified" : ""}`} 
                  type="button" 
                  id="btn-verify" 
                  aria-pressed={verified ? "true" : "false"}
                  onClick={() => {
                    setVerified(!verified);
                    showToast(!verified ? "INC-2023-889 verified. Dispatch authority granted." : "Verification cleared for INC-2023-889.");
                  }}
                >
                  <svg className="btn-verify__icon" aria-hidden="true"><use href="#i-shield-check" /></svg>
                  <span className="btn-verify__label">{verified ? "Incident Verified" : "Verify Incident"}</span>
                </button>
                <p className="alloc__restricted" id="alloc-restricted" hidden>
                  <svg aria-hidden="true"><use href="#i-shield" /></svg>
                  <span>Command functions &mdash; responder allocation and incident verification &mdash; require validated LDRRMO credentials.</span>
                </p>
              </section>
            </div>
          </div>

          <section className="card card--history" aria-labelledby="history-title">
            <h2 className="card__title card__title--history" id="history-title">Incident History</h2>
            <table className="history">
              <thead>
                <tr>
                  <th scope="col">Incident ID</th>
                  <th scope="col">Type</th>
                  <th scope="col">Timestamp (PHT)</th>
                  <th scope="col">Status</th>
                  <th scope="col" className="history__action-head">Action</th>
                </tr>
              </thead>
              <tbody id="history-body">
                {filteredIncidents.map(inc => (
                  <tr key={inc.id} className="history__row">
                    <td className="history__id">{inc.id}</td>
                    <td className="history__type">{inc.type}</td>
                    <td className="history__time">{inc.time}</td>
                    <td>
                      <span className={`pill pill--${inc.status}`}>
                        {inc.status === "active" && <span className="pill__dot" aria-hidden="true" />}
                        {inc.statusLabel}
                      </span>
                    </td>
                    <td className="history__action">
                      <button 
                        type="button" 
                        className="rowbtn" 
                        aria-label={`Open ${inc.id}`} 
                        onClick={() => showToast(`Opening ${inc.id} — incident detail is not wired up in this prototype.`)}
                      >
                        <svg aria-hidden="true"><use href="#i-external" /></svg>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="history__empty" id="history-empty" role="status" hidden={filteredIncidents.length > 0}>No incidents match your search.</p>
          </section>
        </div>
      </main>
      {toastMessage && <p className="toast is-on" role="status" aria-live="polite">{toastMessage}</p>}
    </div>
  );
};
