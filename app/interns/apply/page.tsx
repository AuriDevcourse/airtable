"use client";

import { useRef, useState } from "react";
import { HeroBackdrop } from "@/components/HeroBackdrop";
import { INTERN_DEPARTMENTS } from "@/lib/internDepartments";

// The intern's own form. PUBLIC — see middleware.ts, where this path and its POST route are the
// only two non-/api entries in the allow-list.
//
// It exists because the Airtable API cannot create a form view, and building it here buys two
// things an Airtable form could not: a live counter on the 220-character pitch, so the cap is
// something you see while typing rather than a truncation you discover afterwards, and consent
// wording that names what gets published, where, and until when.
//
// Every gate is server-side in app/api/interns/apply/route.ts. What is below is the same rules
// stated early enough to be useful — an error you can see before you press the button.

const PITCH_MAX = 220;

// Mirrors LIMITS in the route. These are for the counter and the `maxLength` attribute only; the
// server does not trust them.
const LIMITS = { name: 120, role: 120, responsibilities: 400, lookingFor: 160 };

const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

type State = "idle" | "sending" | "done";

export default function InternApplyPage() {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pitch, setPitch] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const formRef = useRef<HTMLFormElement>(null);

  const pitchLeft = PITCH_MAX - pitch.length;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const fd = new FormData(form);

    const file = fd.get("photo");
    let photo: string | null = null;
    let photoFilename: string | null = null;
    if (file instanceof File && file.size > 0) {
      if (file.size > MAX_PHOTO_BYTES) {
        setError("That photo is over 4 MB. Most phones can export a smaller one.");
        return;
      }
      photo = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result));
        r.onerror = () => reject(new Error("read failed"));
        r.readAsDataURL(file);
      }).catch(() => null as unknown as string);
      if (!photo) {
        setError("Could not read that image. Try a different file.");
        return;
      }
      photoFilename = file.name;
    }

    setState("sending");
    try {
      const res = await fetch("/api/interns/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          role: fd.get("role"),
          department: fd.get("department"),
          responsibilities: fd.get("responsibilities"),
          pitch: fd.get("pitch"),
          lookingFor: fd.get("lookingFor"),
          availableFrom: fd.get("availableFrom"),
          linkedin: fd.get("linkedin"),
          email: fd.get("email"),
          consent: fd.get("consent") === "on",
          // The honeypot. Hidden from people, filled in by bots.
          website: fd.get("website"),
          photo,
          photoName: photoFilename,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        setState("idle");
        return;
      }
      setState("done");
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
      setState("idle");
    }
  }

  if (state === "done") {
    return (
      <main>
        <section className="hero">
          <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
          <div className="wrap hero__inner">
            <p className="eyebrow">TechBBQ intern pool</p>
            <h1>
              Thank you, <span className="text-tbbq-gradient">you are in</span>
            </h1>
            <p className="lede">
              Your profile is saved. Someone at TechBBQ checks it and sets the date your card comes
              down, then it goes live on techbbq.dk. If you want anything changed or removed, email{" "}
              <a href="mailto:info@techbbq.org" style={{ textDecoration: "underline" }}>
                info@techbbq.org
              </a>{" "}
              and it will be taken care of.
            </p>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main>
      <section className="hero">
        <HeroBackdrop image="/backgrounds/bg-landscape-3.jpg" />
        <div className="wrap hero__inner">
          <p className="eyebrow">TechBBQ intern pool</p>
          <h1>
            Pitch <span className="text-tbbq-gradient">yourself</span>
          </h1>
          <p className="lede">
            techbbq.dk carries a lot of traffic in August and September, and a good part of it is
            people who hire. This puts you in front of them. Fill this in once, it takes about five
            minutes, and your card goes up for a month.
          </p>
        </div>
      </section>

      <div className="wrap" style={{ paddingBottom: 80 }}>
        <form ref={formRef} onSubmit={onSubmit} className="ap-form" noValidate={false}>
          {/* THE HONEYPOT. aria-hidden and tabIndex -1 so no keyboard or screen-reader user can
              reach it, autoComplete off so no browser fills it in for a real person. */}
          <div className="ap-hp" aria-hidden="true">
            <label htmlFor="ap-website">Website</label>
            <input id="ap-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
          </div>

          <div className="ap-field">
            <label htmlFor="ap-name">
              Your name <span className="ap-req">required</span>
            </label>
            <input id="ap-name" name="name" type="text" required maxLength={LIMITS.name} autoComplete="name" />
          </div>

          <div className="ap-row">
            <div className="ap-field">
              <label htmlFor="ap-role">Your title at TechBBQ</label>
              <input
                id="ap-role"
                name="role"
                type="text"
                maxLength={LIMITS.role}
                placeholder="Marketing Intern"
              />
            </div>
            <div className="ap-field">
              <label htmlFor="ap-dept">
                Department <span className="ap-req">required</span>
              </label>
              <select id="ap-dept" name="department" required defaultValue="">
                <option value="" disabled>
                  Pick one
                </option>
                {INTERN_DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="ap-field">
            <label htmlFor="ap-pitch">
              Your pitch <span className="ap-req">required</span>
            </label>
            <p className="ap-help">
              Thirty seconds, in writing. Who you are and what you are good at. This is the biggest
              text on your card and the part people actually read, so write it like you would say it
              out loud.
            </p>
            <textarea
              id="ap-pitch"
              name="pitch"
              required
              rows={4}
              maxLength={PITCH_MAX}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              aria-describedby="ap-pitch-count"
            />
            <p
              id="ap-pitch-count"
              className={"ap-count" + (pitchLeft <= 20 ? " ap-count--low" : "")}
              aria-live="polite"
            >
              {pitchLeft} characters left
            </p>
          </div>

          <div className="ap-field">
            <label htmlFor="ap-looking">What are you looking for next?</label>
            <p className="ap-help">
              One line. This gets its own box on the card, so a recruiter can read only these and
              still know whether to contact you.
            </p>
            <input
              id="ap-looking"
              name="lookingFor"
              type="text"
              maxLength={LIMITS.lookingFor}
              placeholder="Junior PM role in Copenhagen from October"
            />
          </div>

          <div className="ap-field">
            <label htmlFor="ap-resp">What do you actually do at TechBBQ?</label>
            <p className="ap-help">A line or two. The concrete things you own, not the job description.</p>
            <textarea id="ap-resp" name="responsibilities" rows={3} maxLength={LIMITS.responsibilities} />
          </div>

          <div className="ap-row">
            <div className="ap-field">
              <label htmlFor="ap-from">Available from</label>
              <input id="ap-from" name="availableFrom" type="date" min="2026-01-01" max="2030-12-31" />
            </div>
            <div className="ap-field">
              <label htmlFor="ap-li">LinkedIn</label>
              <input
                id="ap-li"
                name="linkedin"
                type="url"
                placeholder="https://www.linkedin.com/in/you"
                inputMode="url"
              />
            </div>
          </div>

          <div className="ap-field">
            <label htmlFor="ap-photo">Photo</label>
            <p className="ap-help">
              A head-and-shoulders shot. JPG, PNG or WebP, under 4 MB. Your card does not go live
              without one.
            </p>
            <input
              id="ap-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setPhotoName(e.target.files?.[0]?.name ?? null)}
            />
            {photoName && <p className="ap-count">{photoName}</p>}
          </div>

          <div className="ap-field">
            <label htmlFor="ap-email">Your TechBBQ email</label>
            <p className="ap-help">
              So we can reach you about your own card. It is never published and never leaves the
              server.
            </p>
            <input id="ap-email" name="email" type="email" maxLength={254} autoComplete="email" />
          </div>

          {/* The consent gate, worded so it names what is published, where, for how long, and how to
              undo it. A tick against the word "Consent" is not informed consent. */}
          <div className="ap-consent">
            <input id="ap-agree" name="consent" type="checkbox" required />
            <label htmlFor="ap-agree">
              I agree that my name, photo, pitch and LinkedIn link appear on a public page on
              techbbq.dk for about a month, and that anyone can see them. I can ask for my profile
              to be changed or removed at any time by emailing{" "}
              <a href="mailto:info@techbbq.org">info@techbbq.org</a>, and it comes down.{" "}
              <span className="ap-req">required</span>
            </label>
          </div>

          {error && (
            <div className="notice" role="alert" style={{ marginTop: 8 }}>
              <strong>Not sent.</strong>
              <p>{error}</p>
            </div>
          )}

          <button type="submit" className="copy-embed ap-submit" disabled={state === "sending"}>
            {state === "sending" ? "Sending…" : "Put me in the pool"}
          </button>
        </form>
      </div>
    </main>
  );
}
