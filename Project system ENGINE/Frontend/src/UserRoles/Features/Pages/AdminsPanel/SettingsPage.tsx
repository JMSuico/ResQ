// [Layer: AdminsPanel]
// Responsibility: 100% pixel-faithful React 19 conversion of RISKQTRAK settings.html & settings.js.
// Preserves exact classes (.setboard, .set-board, .set-head, .set-grid, .card, .sys, .profile, .notify, .switch, .toast, etc.).
// Universal Lambdas (=>) and zero visual drift.

import React, { useState } from 'react';

export const SettingsPage: React.FC = () => {
  const [threshold, setThreshold] = useState<number>(7);
  const [telemetry, setTelemetry] = useState<string>('1');

  // Notification Switches
  const [switches, setSwitches] = useState<{ [key: string]: boolean }>({
    terminal: true,
    push: true,
    sms: false,
    digest: false
  });

  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastVisible, setToastVisible] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 2800);
  };

  const handleToggleSwitch = (channel: string) => {
    const nextState = !switches[channel];
    setSwitches((prev) => ({ ...prev, [channel]: nextState }));
    showToast(`${channel.toUpperCase()} alerts ${nextState ? 'enabled' : 'disabled'}.`);
  };

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('Platform configuration saved successfully.');
    }, 600);
  };

  return (
    <main className="setboard" aria-label="Platform settings">
      <div className="set-board">
        <header className="set-head">
          <div className="set-head__text">
            <h1 className="set-head__title">Platform Settings</h1>
            <p className="set-head__meta">SYS_CONFIG_v2.4.1&nbsp;&nbsp;//&nbsp;&nbsp;TACTICAL_OVERRIDE_ENABLED</p>
          </div>
          <button className="save-btn" type="button" id="save-btn" onClick={handleSave} disabled={isSaving}>
            <span className="save-btn__label" id="save-label">
              {isSaving ? 'Saving…' : 'Save Configuration'}
            </span>
          </button>
        </header>

        <div className="set-grid">
          {/* Card: System Configuration */}
          <section className="card sys" aria-labelledby="sys-title">
            <header className="card__head">
              <svg className="card__icon" aria-hidden="true"><use href="#i-chip"/></svg>
              <h2 className="card__title" id="sys-title">System Configuration</h2>
            </header>

            <div className="sys__fields">
              <div className="fld">
                <label className="fld__label" htmlFor="threshold">Global Alert Threshold</label>
                <div className="fld__slider">
                  <input
                    className="slider"
                    type="range"
                    id="threshold"
                    min="1"
                    max="10"
                    step="1"
                    value={threshold}
                    onChange={(e) => setThreshold(parseInt(e.target.value, 10))}
                    aria-describedby="threshold-num"
                  />
                  <span className="threshold">
                    <span className="threshold__level">Lv1</span>
                    <span className="threshold__num" id="threshold-num">{threshold}</span>
                  </span>
                </div>
              </div>

              <div className="fld">
                <label className="fld__label" htmlFor="telemetry">Telemetry Refresh Rate</label>
                <div className="select">
                  <select
                    className="select__input"
                    id="telemetry"
                    value={telemetry}
                    onChange={(e) => setTelemetry(e.target.value)}
                  >
                    <option value="1">Real-time (1s)</option>
                    <option value="5">Standard (5s)</option>
                    <option value="15">Relaxed (15s)</option>
                    <option value="30">Low bandwidth (30s)</option>
                  </select>
                  <svg className="select__chevron" aria-hidden="true"><use href="#i-chevron"/></svg>
                </div>
              </div>
            </div>

            <p className="sys__desc">Defines the minimum severity level to trigger command center sirens.</p>

            <aside className="override">
              <svg className="override__icon" aria-hidden="true"><use href="#i-alert"/></svg>
              <div className="override__body">
                <p className="override__title">Critical Override Protocol</p>
                <p className="override__text">
                  Manual dispatch override is currently enabled. System AI will not auto-assign units without human confirmation.
                </p>
              </div>
            </aside>
          </section>

          {/* Card: Profile Settings */}
          <section className="card profile" aria-labelledby="profile-title">
            <header className="card__head">
              <svg className="card__icon" aria-hidden="true"><use href="#i-id-card"/></svg>
              <h2 className="card__title" id="profile-title">Profile Settings</h2>
            </header>

            <img
              className="profile__avatar"
              src="/img/operator-avatar.png"
              alt="Operator credential badge"
              width="91"
              height="91"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <button
              className="profile__update"
              type="button"
              id="btn-credentials"
              onClick={() => showToast('Credential verification portal opening…')}
            >
              Update Credentials
            </button>

            <dl className="profile__fields">
              <div className="profile__group">
                <dt className="profile__label">Operator ID</dt>
                <dd className="profile__value profile__value--mono">OPR-9942-A</dd>
              </div>
              <div className="profile__group">
                <dt className="profile__label">Assigned Station</dt>
                <dd className="profile__value">LDRRMO — Katipunan</dd>
              </div>
            </dl>
          </section>
        </div>

        {/* Section: Notification Routing */}
        <section className="card notify" aria-labelledby="notify-title">
          <header className="card__head">
            <svg className="card__icon" aria-hidden="true"><use href="#i-megaphone"/></svg>
            <h2 className="card__title" id="notify-title">Notification Routing</h2>
          </header>

          <div className="routing">
            <div className="routing__tile">
              <div className="routing__meta">
                <p className="routing__name">Terminal Audio</p>
                <p className="routing__code">SYS.SND.ALRT</p>
              </div>
              <button
                className={`switch ${switches.terminal ? 'is-on' : ''}`}
                type="button"
                role="switch"
                aria-checked={switches.terminal}
                onClick={() => handleToggleSwitch('terminal')}
                aria-label="Terminal Audio"
              ></button>
            </div>

            <div className="routing__tile">
              <div className="routing__meta">
                <p className="routing__name">Push to Mobile</p>
                <p className="routing__code">NET.PUSH.MOB</p>
              </div>
              <button
                className={`switch ${switches.push ? 'is-on' : ''}`}
                type="button"
                role="switch"
                aria-checked={switches.push}
                onClick={() => handleToggleSwitch('push')}
                aria-label="Push to Mobile"
              ></button>
            </div>

            <div className="routing__tile">
              <div className="routing__meta">
                <p className="routing__name">SMS Fallback</p>
                <p className="routing__code">NET.SMS.SEC</p>
              </div>
              <button
                className={`switch ${switches.sms ? 'is-on' : ''}`}
                type="button"
                role="switch"
                aria-checked={switches.sms}
                onClick={() => handleToggleSwitch('sms')}
                aria-label="SMS Fallback"
              ></button>
            </div>

            <div className="routing__tile">
              <div className="routing__meta">
                <p className="routing__name">Daily Log Digest</p>
                <p className="routing__code">CRON.MAIL.LOG</p>
              </div>
              <button
                className={`switch ${switches.digest ? 'is-on' : ''}`}
                type="button"
                role="switch"
                aria-checked={switches.digest}
                onClick={() => handleToggleSwitch('digest')}
                aria-label="Daily Log Digest"
              ></button>
            </div>
          </div>
        </section>
      </div>

      <p className={`toast ${toastVisible ? 'is-on' : ''}`} id="toast" role="status" aria-live="polite">
        {toastMessage}
      </p>
    </main>
  );
};

export default SettingsPage;
