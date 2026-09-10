import {answerWithBrain} from '../../../server/brain';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request){return answerWithBrain(request);}

