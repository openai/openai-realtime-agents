export const BRAINS = {
 realtime: {label:'Realtime',model:'gpt-realtime-2.1',hint:'Direct voice'},
 terra: {label:'Terra',model:'gpt-5.6-terra',hint:'Lower cost'},
 sol: {label:'Sol',model:'gpt-5.6-sol',hint:'Deeper reasoning'},
 astra: {label:'Astra',model:'gpt-6-astra',hint:'Highest capability · highest cost'},
} as const;
export type Brain = keyof typeof BRAINS;
export function isBrain(value: unknown): value is Brain {return typeof value === 'string' && Object.hasOwn(BRAINS,value);}
export type Turn = {role:'user'|'assistant';text:string};
export function recentHistory(turns:Turn[]):Turn[]{
 let remaining=60000;
 return turns.slice(-30).reverse().flatMap(turn=>{const text=turn.text.slice(-Math.min(8000,remaining));if(remaining===0||!text)return [];remaining-=text.length;return [{role:turn.role,text}];}).reverse();
}
export function parseBrainCommand(text:string): {brain:Brain;question:string} | null {
 // Anchored: mentioning a model, quoting a command, or negating it must not switch modes.
 const match=text.trim().match(/^(?:(?:будь ласка|please)[,\s]+)?(?:підключи|підключити|переключи(?:сь)?(?:\s+на)?|перемкни(?:сь)?(?:\s+на)?|увімкни|включи|передай(?:\s+(?:це|питання|запит))?(?:\s+(?:до|на|моделі))?|поверни(?:сь)?(?:\s+(?:до|на))?|connect|switch(?:\s+to)?|use|enable|return(?:\s+to)?|hand\s+off\s+to)(?:\s+(?:режим|модель))?\s+(astra|астра|астру|астрі|sol|сол|солу|соль|соля|terra|тера|терра|терру|теру|тері|террі|realtime|real\s*time|реалтайм|ріалтайм)(?=$|[\s,.!?:;—-])([\s\S]*)$/iu);
 if (!match) return null;
 const alias=match[1].toLowerCase();
 const brain:Brain=/^(astra|аст)/u.test(alias)?'astra':/^(sol|сол)/u.test(alias)?'sol':/^(terra|тер)/u.test(alias)?'terra':'realtime';
 const question=match[2].replace(/^[\s,.!?:;—-]+/u,'').replace(/^(?:будь ласка|please)[.!\s]*$/iu,'').trim();
 return {brain,question};
}
export function brainInstructions(brain:Brain) {
 return brain==='realtime'?'Answer naturally using your own reasoning.':
 'The selected reasoning model is '+BRAINS[brain].label+'. You are its voice interface. Substantive answers are supplied by the application after that model finishes. Read the supplied answer faithfully, preserving its meaning and uncertainty. Do not invent a substitute answer or claim to have used tools. For a mode-change acknowledgement or greeting, follow the supplied instruction.';
}
