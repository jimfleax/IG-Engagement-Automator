/**
 * @file CreatorCard.tsx
 * @description Renders developer credentials, social links, biography, and portfolio projects for the creator.
 * @architecture Presented inside AboutTab, sourcing biographical and project metadata from creatorProfile.ts data layer.
 * @agent_note Opens external URLs safely using window.open with noopener/noreferrer; verify portfolio content schema changes in creatorProfile.ts.
 */
import React from "react";
import {
  Globe,
  GithubLogo,
  LinkedinLogo,
  XLogo,
  EnvelopeSimple,
  ArrowSquareOut,
  Sparkle,
  Code,
  FolderSimple,
} from "@phosphor-icons/react";
import { CREATOR } from "../../data/creatorProfile.ts";

/**
 * Interactive profile card displaying developer bio, social channels, and showcase projects.
 * @author Reetabrata Bhandari
 */
export function CreatorCard(): React.JSX.Element {
  const handleOpenLink = (url: string) => {
    if (!url) return;
    try {
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (_) {
      window.location.href = url;
    }
  };

  return (
    <div className="bg-gradient-to-b from-blue-50/50 via-white to-white rounded-xl border border-blue-200/80 p-4 shadow-xs">
      {/* Profile Header */}
      <div className="flex items-start justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-3">
          {/* Avatar Monogram */}
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-sky-500 flex items-center justify-center text-white font-black text-base shadow-sm shrink-0 border border-white">
            <span>RB</span>
            <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" title="Active Developer" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm text-slate-900 tracking-tight">{CREATOR.name}</h3>
              <span className="text-[10px] bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full border border-blue-200">
                @{CREATOR.alias.replace(/\s+/g, "").toLowerCase()}
              </span>
            </div>
            <p className="text-xs text-blue-700 font-medium">{CREATOR.title}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Self-Taught Programmer & Full-Stack Architect</p>
          </div>
        </div>

        {/* Portfolio Button */}
        <button
          type="button"
          onClick={() => handleOpenLink(CREATOR.siteUrl)}
          className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-colors cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5" weight="bold" />
          <span>jimfleax.in</span>
          <ArrowSquareOut className="w-3 h-3 opacity-80" weight="bold" />
        </button>
      </div>

      {/* Bio Paragraph */}
      <div className="bg-white/90 rounded-lg p-3 border border-slate-200/80 text-xs text-slate-600 leading-relaxed mb-3.5">
        <p className="line-clamp-4">
          {CREATOR.bio.split("\n\n")[0]}
        </p>
      </div>

      {/* Core Tech Stack */}
      <div className="mb-3.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2.5">
          <Code className="w-3.5 h-3.5 text-blue-600" weight="bold" />
          <span>Core Technologies</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CREATOR.technologies.map((tech) => (
            <span
              key={tech}
              className="text-[11px] bg-slate-100/90 text-slate-700 font-medium px-2.5 py-1 rounded-md border border-slate-200/70"
            >
              {tech}
            </span>
          ))}
          <span className="text-[11px] bg-indigo-50 text-indigo-700 font-medium px-2.5 py-1 rounded-md border border-indigo-200/70">
            Framer Motion
          </span>
        </div>
      </div>

      {/* Social & Connect Row */}
      <div className="mb-4">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
          <Sparkle className="w-3.5 h-3.5 text-amber-500" weight="fill" />
          <span>Connect & Profiles</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => handleOpenLink(CREATOR.socials.github)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-slate-900 hover:bg-slate-800 text-white transition-colors cursor-pointer justify-center"
          >
            <GithubLogo className="w-3.5 h-3.5" weight="fill" />
            <span>GitHub</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenLink(CREATOR.socials.linkedin)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-[#0077b5] hover:bg-[#006097] text-white transition-colors cursor-pointer justify-center"
          >
            <LinkedinLogo className="w-3.5 h-3.5" weight="fill" />
            <span>LinkedIn</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenLink(CREATOR.socials.x)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-black hover:bg-slate-800 text-white transition-colors cursor-pointer justify-center"
          >
            <XLogo className="w-3.5 h-3.5" weight="bold" />
            <span>X (Twitter)</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenLink(`mailto:${CREATOR.email}`)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 hover:bg-rose-700 text-white transition-colors cursor-pointer justify-center"
          >
            <EnvelopeSimple className="w-3.5 h-3.5" weight="bold" />
            <span>Email</span>
          </button>
        </div>
      </div>

      {/* Featured Creations */}
      <div>
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
          <div className="flex items-center gap-1.5">
            <FolderSimple className="w-3.5 h-3.5 text-blue-600" weight="bold" />
            <span>Featured Creations (Portfolio)</span>
          </div>
          <button
            type="button"
            onClick={() => handleOpenLink(CREATOR.siteUrl)}
            className="text-[10px] text-blue-600 hover:underline font-medium normal-case flex items-center gap-0.5"
          >
            View all projects
            <ArrowSquareOut className="w-2.5 h-2.5" weight="bold" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CREATOR.projects.map((proj) => (
            <div
              key={proj.title}
              onClick={() => handleOpenLink(proj.url)}
              className="group p-2.5 rounded-lg border border-slate-200/90 bg-white hover:border-blue-300 hover:shadow-xs transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="font-bold text-xs text-slate-800 group-hover:text-blue-600 transition-colors">
                    {proj.title}
                  </span>
                  <ArrowSquareOut className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors" weight="bold" />
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-snug mb-2">
                  {proj.description}
                </p>
              </div>

              <div className="flex flex-wrap gap-1 mt-1">
                {proj.techStack.slice(0, 3).map((st) => (
                  <span
                    key={st}
                    className="text-[9.5px] bg-slate-50 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200/60 font-mono"
                  >
                    {st}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
