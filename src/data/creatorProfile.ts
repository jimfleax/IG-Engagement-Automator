/**
 * @file creatorProfile.ts
 * @description Aggregates developer metadata, biographies, social links, and portfolio project records.
 * @architecture Acts as the static data layer for the About view, consuming synced JSON data from the creator portfolio.
 * @agent_note Uses import attributes `with { type: "json" }`; keep fallback values resilient if portfolio-content.json is absent.
 * @author Reetabrata Bhandari
 */
import portfolioData from "./portfolio-content.json" with { type: "json" };

export interface CreatorSocials {
  github: string;
  linkedin: string;
  x: string;
  substack: string;
  whatsapp: string;
}

export interface CreatorSkill {
  name: string;
  percent: number;
}

export interface CreatorProject {
  title: string;
  url: string;
  github: string | null;
  description: string;
  techStack: string[];
}

export interface CreatorJourney {
  title: string;
  role: string;
  description: string;
}

export interface CreatorProfile {
  name: string;
  alias: string;
  title: string;
  tagline: string;
  bio: string;
  summary: string;
  siteUrl: string;
  email: string;
  socials: CreatorSocials;
  technologies: string[];
  skills: CreatorSkill[];
  projects: CreatorProject[];
  journey: CreatorJourney[];
}

export const CREATOR: CreatorProfile = {
  name: (portfolioData as any)?.metadata?.authorName || "Reetabrata Bhandari",
  alias: "Jim Fleax",
  title: "Full Stack Web Developer & Software Engineer",
  tagline: "Building sleek, high-performance web applications & intelligent browser tools.",
  bio:
    (portfolioData as any)?.home?.about?.paragraph ||
    "Hi there! I'm Reetabrata Bhandari—better known as Jim Fleax! 👋 I’m passionate about exploring computer languages and crafting innovative apps and websites. My goal is to create sleek, delicious interfaces that seamlessly blend with powerful logic and robust backends.",
  summary:
    (portfolioData as any)?.home?.terminal?.summary ||
    "Jim Fleax is a highly skilled full-stack developer specializing in building sleek, high-performance web applications with modern technologies like React, Next.js, Python, and MongoDB.",
  siteUrl: (portfolioData as any)?.metadata?.siteUrl || "https://jimfleax.in",
  email: "reetabrata.bhandari@gmail.com",
  socials: {
    github: "https://github.com/jimfleax",
    linkedin: "https://www.linkedin.com/in/jimfleax",
    x: "https://x.com/jimfleax",
    substack: "https://jimfleax.substack.com",
    whatsapp: "https://wa.link/q4kxyg",
  },
  technologies: (portfolioData as any)?.home?.terminal?.technologies || [
    "React / Next.js",
    "TypeScript",
    "Tailwind CSS",
    "Node.js / Express.js",
    "MongoDB",
    "Python / Docker",
  ],
  skills: [
    { name: "React / Next.js", percent: 85 },
    { name: "Node.js / Express", percent: 75 },
    { name: "MongoDB", percent: 70 },
    { name: "Tailwind CSS", percent: 90 },
  ],
  projects: (((portfolioData as any)?.home?.projects?.items as any[]) || []).slice(0, 4).map((p) => ({
    title: p.title,
    url: p.url.startsWith("http") ? p.url : `https://${p.url}`,
    github: p.github || null,
    description: p.description,
    techStack: p.techStack || [],
  })),
  journey: (((portfolioData as any)?.home?.journey?.items as any[]) || []).map((j) => ({
    title: j.title,
    role: j.role,
    description: j.description,
  })),
};
