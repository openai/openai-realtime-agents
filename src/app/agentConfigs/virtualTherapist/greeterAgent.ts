import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { exampleUserProfiles } from './sampleData';

export const greeterAgent = new RealtimeAgent({
    name: 'greeterTherapist',
    voice: 'alloy',
    handoffDescription: 'Initial agent that greets users, gathers their information, and connects them with their virtual therapist.',

    instructions: `
# Identity and Role
You are a warm, welcoming intake coordinator for WellCare Virtual Therapy. Your role is to create a safe, comfortable first impression and help users connect with their virtual therapist. You have a gentle, professional demeanor that puts people at ease.

# Personality and Tone
## Identity
You are a compassionate intake coordinator who helps people access mental health support. You understand that reaching out for therapy can feel vulnerable, so you create a welcoming, non-judgmental environment from the very first interaction.

## Task
Your primary role is to:
1. Warmly greet users and explain the process
2. Gather their information (name and/or phone number) to identify them
3. Look up their profile to personalize the experience
4. Seamlessly connect them with their virtual therapist

## Demeanor
Warm, professional, and reassuring. You speak with genuine care and make users feel welcomed and understood.

## Tone
Gentle, professional, and welcoming. You use a calm, soothing voice that conveys safety and trust.

## Level of Enthusiasm
Measured and appropriate. You show genuine warmth without being overly energetic, as users may be in vulnerable emotional states.

## Level of Formality
Professional but approachable. You maintain appropriate boundaries while being warm and accessible.

## Pacing
Calm and unhurried. You give people time to feel comfortable and never rush the process.

# Conversation Flow
1. **Warm Greeting**: Start with a gentle, welcoming greeting that explains who you are
2. **Gather Information**: Ask for their name and/or phone number to look up their profile
3. **Profile Lookup**: Use getUserInfo to find their information
4. **Handle Results**:
   - If found: Welcome them back and explain you'll connect them with their therapist
   - If multiple matches: Ask for phone number to clarify
   - If not found: Welcome them as a new client and explain the process
5. **Handoff**: Connect them with their virtual therapist

# Sample Greetings
- "Hello, and welcome to WellCare Virtual Therapy. I'm here to help connect you with your therapist today. How are you feeling?"
- "Hi there, thank you for reaching out to WellCare Virtual Therapy. I'm going to help get you connected with the right support. May I start by getting your name?"
- "Welcome to WellCare Virtual Therapy. I know it can take courage to reach out, and I'm glad you're here. Let me help you get connected with your therapist."

# Instructions for Handoff
- Once you have successfully identified the user (or welcomed them as new), hand off to the 'virtualTherapist' agent
- Always hand off after completing the user identification process, whether they are:
  - An existing client you've successfully identified
  - A new client without a profile
  - A client where identification needs clarification (hand off with a note about this)
- Make the transition feel seamless and supportive
- Use phrases like: "Now I'm going to connect you with your therapist" or "Let me transfer you to Dr. Therapy who will be able to provide you with the support you need"

Remember: You are the first point of contact and set the tone for their entire therapy experience. Be warm, professional, and create a sense of safety and trust.
`,

    tools: [
        tool({
            name: 'getUserInfo',
            description: 'Retrieves user profile information using their name, phone number, or both. If searching by name only and multiple people have the same name, you\'ll need to ask for their phone number to disambiguate.',
            parameters: {
                type: 'object',
                properties: {
                    name: {
                        type: 'string',
                        description: 'User\'s first name, last name, or full name to search for'
                    },
                    phoneNumber: {
                        type: 'string',
                        description: 'User phone number to look up their profile (format: 555-0123 or any format)'
                    }
                },
                required: [],
                additionalProperties: false
            },
            execute: async (input: any) => {
                const { name, phoneNumber } = input as { name?: string; phoneNumber?: string };

                if (!name && !phoneNumber) {
                    return {
                        found: false,
                        error: "Please provide either a name or phone number to look up the user profile."
                    };
                }

                const allProfiles = Object.values(exampleUserProfiles);
                let matchingProfiles: typeof allProfiles = [];

                // If phone number is provided, try exact phone match first
                if (phoneNumber) {
                    const cleanPhone = phoneNumber.replace(/[^\d]/g, '');
                    const formattedPhone = `${cleanPhone.slice(0, 3)}-${cleanPhone.slice(3, 7)}`;

                    const phoneProfile = exampleUserProfiles[formattedPhone as keyof typeof exampleUserProfiles];
                    if (phoneProfile) {
                        // If we have both name and phone, verify they match
                        if (name) {
                            const nameMatch = phoneProfile.name.toLowerCase().includes(name.toLowerCase()) ||
                                phoneProfile.preferredName.toLowerCase().includes(name.toLowerCase());
                            if (!nameMatch) {
                                return {
                                    found: false,
                                    error: `The phone number ${phoneNumber} belongs to ${phoneProfile.name}, but you searched for "${name}". Please check the information and try again.`
                                };
                            }
                        }

                        return {
                            found: true,
                            profile: {
                                name: phoneProfile.name,
                                preferredName: phoneProfile.preferredName,
                                age: phoneProfile.age,
                                therapyHistory: phoneProfile.therapyHistory,
                                riskFactors: phoneProfile.riskFactors,
                                emergencyContact: phoneProfile.emergencyContact
                            },
                            welcomeMessage: `Welcome back, ${phoneProfile.preferredName}! I see we last spoke on ${phoneProfile.therapyHistory.lastSession}. I'm going to connect you with your therapist now.`
                        };
                    }
                }

                // If name is provided, search by name
                if (name) {
                    matchingProfiles = allProfiles.filter(profile => {
                        const searchName = name.toLowerCase();
                        return profile.name.toLowerCase().includes(searchName) ||
                            profile.preferredName.toLowerCase().includes(searchName);
                    });

                    if (matchingProfiles.length === 0) {
                        return {
                            found: false,
                            message: `I couldn't find anyone with the name "${name}". Could you double-check the spelling, or would you like to provide your phone number instead? If you're new to our service, that's perfectly fine too.`
                        };
                    }

                    if (matchingProfiles.length === 1) {
                        const profile = matchingProfiles[0];
                        return {
                            found: true,
                            profile: {
                                name: profile.name,
                                preferredName: profile.preferredName,
                                age: profile.age,
                                therapyHistory: profile.therapyHistory,
                                riskFactors: profile.riskFactors,
                                emergencyContact: profile.emergencyContact
                            },
                            welcomeMessage: `Welcome back, ${profile.preferredName}! I see we last spoke on ${profile.therapyHistory.lastSession}. I'm going to connect you with your therapist now.`
                        };
                    }

                    if (matchingProfiles.length > 1) {
                        const names = matchingProfiles.map(p => `${p.name} (${p.phone})`).join(', ');
                        return {
                            found: false,
                            multipleMatches: true,
                            message: `I found multiple people with the name "${name}": ${names}. Could you please provide your phone number so I can identify you correctly?`,
                            matchingProfiles: matchingProfiles.map(p => ({ name: p.name, phone: p.phone }))
                        };
                    }
                }

                // If we get here, phone number was provided but not found
                return {
                    found: false,
                    message: "I don't have your profile information yet, but that's perfectly fine! Welcome to WellCare Virtual Therapy. I'll connect you with your therapist who can help get you set up."
                };
            }
        })
    ],

    handoffs: []  // Will be populated with virtualTherapistAgent in index.ts
}); 