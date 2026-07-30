export type Decision = "reach_out" | "ask_first" | "stay_quiet";

export interface Memory {
  id: string;
  kind: "voice_note" | "chat" | "story";
  title: string;
  excerpt: string;
}

export interface Moment {
  id: string;
  title: string;
  when: string;
  decision: Decision;
  reasoning: string[];
  message?: {
    text: string;
    audioSrc: string;
    memoryIds: string[];
  };
}

// Synthetic demo data only — per hackathon rules, no real personal data.
export const memories: Memory[] = [
  {
    id: "mem-uni-interview",
    kind: "voice_note",
    title: "Voice note — before your uni interview, 2021",
    excerpt:
      "You've never once walked into a room you didn't belong in. Go show them.",
  },
  {
    id: "mem-lucky-breakfast",
    kind: "story",
    title: "The lucky breakfast",
    excerpt:
      "Every big day started with eggs on toast and terrible coffee. His rule, not yours.",
  },
  {
    id: "mem-first-job",
    kind: "chat",
    title: "Chat — the night before your first job",
    excerpt: "Nervous is just excited with nowhere to go yet. Sleep. Call me after.",
  },
  {
    id: "mem-birthday-song",
    kind: "voice_note",
    title: "Voice note — Mum's birthday, 2022",
    excerpt: "Off-key as ever. He never once got through the second verse.",
  },
  {
    id: "mem-sunday-walks",
    kind: "story",
    title: "Sunday walks on the heath",
    excerpt: "Problems, he said, are smaller outdoors.",
  },
];

export const moments: Moment[] = [
  {
    id: "moment-interview",
    title: "Job interview — Vercel",
    when: "Tomorrow, 9:00 AM",
    decision: "reach_out",
    reasoning: [
      "High-stakes moment on Maya's calendar in under 24 hours.",
      "Dad had a pre-interview ritual: a pep talk the night before.",
      "Found a matching memory — his voice note before her uni interview.",
      "Last check-in was 9 days ago; a message now supports, not crowds.",
      "Decision: send an encouraging voice message tonight.",
    ],
    message: {
      text:
        "Hey May. Big one tomorrow. Remember what I told you before your uni interview — you've never once walked into a room you didn't belong in. Eggs on toast in the morning, terrible coffee, and go show them. Call your mum after.",
      audioSrc: "/audio/interview.mp3",
      memoryIds: ["mem-uni-interview", "mem-lucky-breakfast", "mem-first-job"],
    },
  },
  {
    id: "moment-mums-birthday",
    title: "Mum's birthday — the first without Dad",
    when: "Friday",
    decision: "ask_first",
    reasoning: [
      "Emotionally heavy date: first family birthday since Dad passed.",
      "He never missed it — there's a voice note of him singing in 2022.",
      "Grief anniversaries cut both ways; a surprise message could hurt.",
      "Decision: ask Maya first instead of reaching out unprompted.",
    ],
  },
  {
    id: "moment-quiet-tuesday",
    title: "Tuesday",
    when: "Nothing planned",
    decision: "stay_quiet",
    reasoning: [
      "No significant events on the calendar.",
      "No signals that Maya wants company today.",
      "Reached out 2 days ago — presence needs space to mean something.",
      "Decision: stay quiet.",
    ],
  },
];
