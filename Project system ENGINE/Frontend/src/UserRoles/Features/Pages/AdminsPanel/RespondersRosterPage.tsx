import React, { useState } from "react";

export const RespondersRosterPage: React.FC = () => {
  const [filter, setFilter] = useState("all");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [units, setUnits] = useState([
    { id: "PNP-UNIT-04", person: "Juan Cruz", status: "arrived", statusLabel: "Arrived", incident: "INC-2023-081A" },
    { id: "RHU-AMB-12", person: "Paul Santos", status: "enroute", statusLabel: "En Route", incident: "INC-2023-089C" },
    { id: "BFP-TRUCK-02", person: "Mario Reyes", status: "arrived", statusLabel: "Arrived", incident: "INC-2023-085B" }
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  const filteredUnits = units.filter(unit => {
    if (filter !== "all" && unit.status !== filter) return false;
    if (!query) return true;
    return `${unit.id} ${unit.person} ${unit.incident}`.toLowerCase().includes(query.toLowerCase());
  });

  return (
    <div className="dash">
      <main className="rspboard" aria-label="Responder roster">
        <div className="rsp-board">
          <section className="rsp-stats" aria-label="Active units by agency">
            <article className="stat-card">
              <header className="stat-card__head">
                <span className="stat-card__badge" aria-hidden="true"><svg><use href="#i-medical-box" /></svg></span>
                <h2 className="stat-card__title">RHU (Medical)</h2>
              </header>
              <p className="stat-card__label">Active Units</p>
              <p className="stat-card__value">12</p>
            </article>

            <article className="stat-card">
              <header className="stat-card__head">
                <span className="stat-card__badge" aria-hidden="true"><svg><use href="#i-police-shield" /></svg></span>
                <h2 className="stat-card__title">PNP (Police)</h2>
              </header>
              <p className="stat-card__label">Active Units</p>
              <p className="stat-card__value">08</p>
            </article>

            <article className="stat-card">
              <header className="stat-card__head">
                <span className="stat-card__badge" aria-hidden="true"><svg><use href="#i-fire-truck" /></svg></span>
                <h2 className="stat-card__title">BFP (Fire)</h2>
              </header>
              <p className="stat-card__label is-muted">Active Units</p>
              <p className="stat-card__value">05</p>
            </article>
          </section>

          <section className="duty" aria-labelledby="duty-title">
            <header className="duty__head">
              <h2 className="duty__title" id="duty-title">Active Duty Units</h2>
              <div className="duty__filter">
                <button 
                  className="filter-btn" 
                  type="button" 
                  id="filter-btn"
                  aria-haspopup="true" 
                  aria-expanded={isMenuOpen} 
                  aria-controls="filter-menu"
                  onClick={() => setIsMenuOpen(!isMenuOpen)}
                >
                  Filter
                </button>
                <div className={`filter-menu ${isMenuOpen ? "" : ""}`} id="filter-menu" role="menu" aria-label="Filter units by status" hidden={!isMenuOpen}>
                  <button 
                    className={`filter-menu__item ${filter === "all" ? "is-checked" : ""}`} 
                    type="button" 
                    role="menuitemradio"
                    aria-checked={filter === "all"} 
                    data-filter="all"
                    onClick={() => { setFilter("all"); setIsMenuOpen(false); }}
                  >
                    All units
                  </button>
                  <button 
                    className={`filter-menu__item ${filter === "arrived" ? "is-checked" : ""}`} 
                    type="button" 
                    role="menuitemradio"
                    aria-checked={filter === "arrived"} 
                    data-filter="arrived"
                    onClick={() => { setFilter("arrived"); setIsMenuOpen(false); }}
                  >
                    Arrived
                  </button>
                  <button 
                    className={`filter-menu__item ${filter === "enroute" ? "is-checked" : ""}`} 
                    type="button" 
                    role="menuitemradio"
                    aria-checked={filter === "enroute"} 
                    data-filter="enroute"
                    onClick={() => { setFilter("enroute"); setIsMenuOpen(false); }}
                  >
                    En Route
                  </button>
                </div>
              </div>
            </header>

            <div className="duty__scroll">
              <table className="duty__table">
                <colgroup>
                  <col style={{ width: "19%" }} />
                  <col style={{ width: "17%" }} />
                  <col style={{ width: "18%" }} />
                  <col style={{ width: "30%" }} />
                  <col style={{ width: "16%" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">Unit ID</th>
                    <th scope="col">Personnel</th>
                    <th scope="col">Status</th>
                    <th scope="col">Assigned Incident</th>
                    <th scope="col">Actions</th>
                  </tr>
                </thead>
                <tbody id="duty-body">
                  {filteredUnits.map(unit => (
                    <tr key={unit.id} className="duty__row">
                      <td className="duty__id">{unit.id}</td>
                      <td className="duty__person">{unit.person}</td>
                      <td>
                        <span className={`pill pill--${unit.status}`}>
                          <span className="pill__dot" aria-hidden="true" />
                          {unit.statusLabel}
                        </span>
                      </td>
                      <td className="duty__incident">{unit.incident}</td>
                      <td>
                        <button 
                          type="button" 
                          className="rowbtn" 
                          aria-label={`Open unit ${unit.id}`}
                          onClick={() => showToast(`Opening ${unit.id} — unit detail is not wired up in this prototype.`)}
                        >
                          <svg aria-hidden="true"><use href="#i-external" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="duty__empty" id="duty-empty" role="status" hidden={filteredUnits.length > 0}>No active units match the current filter.</p>
            </div>
          </section>
        </div>
      </main>
      {toastMessage && <p className="toast is-on" role="status" aria-live="polite">{toastMessage}</p>}
    </div>
  );
};
