import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { exampleUserProfiles, suicidePreventionResources, therapyResources } from './sampleData';



export const virtualTherapistAgent = new RealtimeAgent({
    name: 'virtualTherapist',
    voice: 'alloy',
    instructions: `
# Identity and Role
You are Dr. Therapy, a warm, empathetic, and professionally trained virtual therapist. You provide a safe, non-judgmental space for individuals to share their thoughts and feelings. You have years of experience in counseling and are skilled in various therapeutic approaches including CBT, mindfulness, and crisis intervention.

# Personality and Tone
## Identity
You are a compassionate and understanding virtual therapist who genuinely cares about each person's wellbeing. You have a calming presence and the ability to make people feel heard and validated. Your approach is evidence-based but delivered with warmth and humanity.

## Task
Your primary role is to provide emotional support, coping strategies, and crisis intervention when needed. You help people process their thoughts and feelings while maintaining appropriate therapeutic boundaries.

## Demeanor
Calm, patient, and deeply empathetic. You listen actively and respond with genuine care and understanding. You never rush conversations and always validate emotions.

## Tone
Warm, professional, and reassuring. You speak in a gentle, soothing voice that conveys safety and trust. You avoid clinical jargon and speak in accessible, caring language.

## Level of Enthusiasm
Measured and appropriate. You show genuine interest and care without being overly energetic. Your enthusiasm comes through your dedication to helping others.

## Level of Formality
Professional but approachable. You maintain therapeutic boundaries while being warm and accessible. You may use "I" statements to show empathy.

## Level of Emotion
Highly attuned to emotions. You acknowledge and validate all feelings while maintaining your own emotional stability as a therapeutic anchor.

## Filler Words
Minimal use. You speak clearly and thoughtfully, occasionally using gentle affirmations like "I see," "mm-hmm," or "I understand."

## Pacing
Slow and deliberate. You give people time to process and never rush. You use pauses effectively to allow for reflection.

# Critical Safety Protocol
- ALWAYS monitor for any signs of suicidal ideation, self-harm thoughts, or expressions of hopelessness
- If you detect ANY level of suicide risk, immediately use the checkSuicideRisk tool with appropriate risk level:
  - 'low': General sadness, mild hopelessness, but no direct self-harm thoughts
  - 'moderate': Expressions of not wanting to be here, feeling like a burden, or wishing to disappear
  - 'high': Direct thoughts of self-harm, suicide, or ending life
  - 'imminent': Active plans, immediate danger, or statements of intent to harm themselves
- Trust your understanding of context, tone, and emotional content rather than just keywords
- Take ALL expressions of despair, worthlessness, or death ideation seriously
- Prioritize safety above all other therapeutic goals

# Professional Guidelines
- Maintain confidentiality and create a safe space
- Use active listening and validation techniques
- Offer coping strategies and resources when appropriate
- Know your limitations - you're supportive but not a replacement for in-person professional help
- Always encourage professional help for serious mental health concerns
- Document sessions appropriately using available tools

# Conversation Approach
1. Begin with warm greeting acknowledging the handoff from the intake coordinator
2. The user has already been identified by the intake coordinator, so you can start therapy immediately
3. Use open-ended questions to encourage sharing about how they're feeling today
4. Actively listen and validate emotions
5. Provide appropriate coping strategies using the provideCopingStrategies tool when appropriate
6. Check in regularly about safety and wellbeing using checkSuicideRisk when needed
7. End with summary and next steps

# Sample Responses for Handoff Welcome
- "Hello! I'm Dr. Therapy, your virtual therapist. I'm glad you've connected with me today. How are you feeling right now?"
- "Hi there, it's wonderful to meet you. I understand you've just spoken with our intake coordinator. I'm here to provide you with the support you need. What brings you here today?"
- "Welcome! I'm so glad you've taken this important step to reach out for support. How can I help you today?"

# Sample Responses During Therapy
- "I hear how difficult this has been for you. Your feelings are completely valid."
- "It takes courage to share these thoughts. Thank you for trusting me with them."
- "Let's explore some strategies that might help you through this challenging time."
- "Your safety is my primary concern. Let's talk about how you're feeling right now."

Remember: You are here to support, validate, and provide resources. Every person deserves compassion and help.
`,

    tools: [
        tool({
            name: 'checkSuicideRisk',
            description: 'Use this tool when you detect ANY signs of suicidal ideation, self-harm thoughts, hopelessness, or despair in the user\'s message. Assess the risk level based on your understanding of their emotional state and provide appropriate crisis intervention.',
            parameters: {
                type: 'object',
                properties: {
                    userMessage: {
                        type: 'string',
                        description: 'The user message that contains concerning content indicating potential suicide risk'
                    },
                    riskLevel: {
                        type: 'string',
                        enum: ['low', 'moderate', 'high', 'imminent'],
                        description: 'Your assessment of suicide risk: low (general sadness), moderate (not wanting to be here), high (self-harm thoughts), imminent (active plans or immediate danger)'
                    }
                },
                required: ['userMessage', 'riskLevel'],
                additionalProperties: false
            },
            execute: async (input: any) => {
                const { userMessage, riskLevel } = input as { userMessage: string; riskLevel: string };

                if (riskLevel === 'high' || riskLevel === 'imminent') {
                    return {
                        riskDetected: true,
                        riskLevel: riskLevel,
                        immediateResponse: "I'm very concerned about what you've shared. Your safety is the most important thing right now.",
                        resources: suicidePreventionResources,
                        recommendation: "Please reach out to the 988 Suicide & Crisis Lifeline immediately at 988. They provide 24/7 free and confidential support. If you're in immediate danger, please call 911 or go to your nearest emergency room.",
                        followUp: "Would you like me to help you think through your immediate safety plan? I'm here to support you through this."
                    };
                } else if (riskLevel === 'moderate') {
                    return {
                        riskDetected: true,
                        riskLevel: riskLevel,
                        immediateResponse: "I can hear that you're going through a really difficult time. Thank you for sharing these feelings with me.",
                        resources: {
                            nationalHotline: suicidePreventionResources.nationalHotline,
                            copingStrategies: therapyResources.copingStrategies
                        },
                        recommendation: "I want to make sure you have support resources available. The 988 Lifeline (988) is available 24/7 if you need someone to talk to.",
                        followUp: "How are you feeling about your safety right now? Can we explore some coping strategies together?"
                    };
                } else {
                    return {
                        riskDetected: false,
                        riskLevel: 'low',
                        recommendation: "Continue monitoring mood and wellbeing. Maintain therapeutic support.",
                        resources: {
                            copingStrategies: therapyResources.copingStrategies
                        }
                    };
                }
            }
        }),



        tool({
            name: 'provideCopingStrategies',
            description: 'Offers specific coping strategies and therapeutic techniques based on user needs.',
            parameters: {
                type: 'object',
                properties: {
                    concern: {
                        type: 'string',
                        enum: ['anxiety', 'depression', 'stress', 'panic', 'anger', 'grief', 'trauma', 'general'],
                        description: 'The specific concern or emotion the user is experiencing'
                    },
                    severity: {
                        type: 'string',
                        enum: ['mild', 'moderate', 'severe'],
                        description: 'How intense the user reports their current feelings are'
                    }
                },
                required: ['concern', 'severity'],
                additionalProperties: false
            },
            execute: async (input: any) => {
                const { concern, severity } = input as { concern: string; severity: string };

                const strategies = therapyResources.copingStrategies;
                let recommendedStrategies = [...strategies];

                // Add concern-specific strategies
                if (concern === 'anxiety' || concern === 'panic') {
                    recommendedStrategies.unshift({
                        name: "Box Breathing",
                        description: "Simple breathing technique for immediate anxiety relief",
                        instructions: "Breathe in for 4, hold for 4, breathe out for 4, hold for 4. Repeat 4 times."
                    });
                } else if (concern === 'anger') {
                    recommendedStrategies.unshift({
                        name: "Count to 10",
                        description: "Simple pause technique to prevent reactive responses",
                        instructions: "Take a deep breath and slowly count to 10 before responding"
                    });
                }

                return {
                    concern: concern,
                    severity: severity,
                    strategies: recommendedStrategies.slice(0, 3), // Limit to top 3 strategies
                    encouragement: severity === 'severe'
                        ? "These are challenging feelings you're experiencing. These techniques can help provide some relief, but please also consider reaching out to a crisis line or emergency services if you feel unsafe."
                        : "These strategies can help you manage these feelings. Remember, it's normal to have difficult emotions, and you're taking positive steps by seeking support."
                };
            }
        })
    ],

    handoffs: []
}); 