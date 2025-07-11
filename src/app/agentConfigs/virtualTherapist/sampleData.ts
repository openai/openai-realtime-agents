export const exampleUserProfiles = {
    "555-0123": {
        userId: "VT-001",
        name: "Sarah Johnson",
        phone: "555-0123",
        email: "sarah.j@email.com",
        age: 28,
        preferredName: "Sarah",
        emergencyContact: {
            name: "Mike Johnson",
            relationship: "Brother",
            phone: "555-0124"
        },
        therapyHistory: {
            previousSessions: 5,
            lastSession: "2024-01-15",
            mainConcerns: ["anxiety", "work stress", "relationship issues"],
            goals: ["stress management", "better communication", "work-life balance"]
        },
        riskFactors: {
            hasHistory: false,
            currentRiskLevel: "low",
            lastAssessment: "2024-01-10"
        }
    },
    "555-0567": {
        userId: "VT-002",
        name: "Alex Chen",
        phone: "555-0567",
        email: "alex.chen@email.com",
        age: 34,
        preferredName: "Alex",
        emergencyContact: {
            name: "Jamie Chen",
            relationship: "Spouse",
            phone: "555-0568"
        },
        therapyHistory: {
            previousSessions: 12,
            lastSession: "2024-01-12",
            mainConcerns: ["depression", "career transition", "family dynamics"],
            goals: ["mood improvement", "career clarity", "family relationships"]
        },
        riskFactors: {
            hasHistory: true,
            currentRiskLevel: "moderate",
            lastAssessment: "2024-01-12"
        }
    },
    "555-0890": {
        userId: "VT-003",
        name: "Jordan Smith",
        phone: "555-0890",
        email: "jordan.smith@email.com",
        age: 22,
        preferredName: "Jordan",
        emergencyContact: {
            name: "Pat Smith",
            relationship: "Parent",
            phone: "555-0891"
        },
        therapyHistory: {
            previousSessions: 2,
            lastSession: "2024-01-08",
            mainConcerns: ["social anxiety", "academic pressure", "identity exploration"],
            goals: ["confidence building", "stress reduction", "self-acceptance"]
        },
        riskFactors: {
            hasHistory: false,
            currentRiskLevel: "low",
            lastAssessment: "2024-01-08"
        }
    },
    "555-0445": {
        userId: "VT-004",
        name: "Sarah Miller",
        phone: "555-0445",
        email: "sarah.miller@email.com",
        age: 31,
        preferredName: "Sarah",
        emergencyContact: {
            name: "Tom Miller",
            relationship: "Husband",
            phone: "555-0446"
        },
        therapyHistory: {
            previousSessions: 8,
            lastSession: "2024-01-14",
            mainConcerns: ["grief", "loss of parent", "adjustment"],
            goals: ["grief processing", "emotional healing", "rebuilding routine"]
        },
        riskFactors: {
            hasHistory: false,
            currentRiskLevel: "low",
            lastAssessment: "2024-01-14"
        }
    },
    "555-0778": {
        userId: "VT-005",
        name: "Michael Johnson",
        phone: "555-0778",
        email: "mike.johnson@email.com",
        age: 45,
        preferredName: "Mike",
        emergencyContact: {
            name: "Lisa Johnson",
            relationship: "Wife",
            phone: "555-0779"
        },
        therapyHistory: {
            previousSessions: 15,
            lastSession: "2024-01-16",
            mainConcerns: ["work stress", "burnout", "family balance"],
            goals: ["stress management", "work boundaries", "quality time with family"]
        },
        riskFactors: {
            hasHistory: false,
            currentRiskLevel: "low",
            lastAssessment: "2024-01-16"
        }
    }
};

export const suicidePreventionResources = {
    nationalHotline: {
        name: "988 Suicide & Crisis Lifeline",
        phone: "988",
        description: "24/7 free and confidential support for people in distress"
    },
    textSupport: {
        name: "Crisis Text Line",
        number: "741741",
        text: "HOME",
        description: "Text HOME to 741741 for crisis support via text message"
    },
    alternativeResources: [
        {
            name: "SAMHSA National Helpline",
            phone: "1-800-662-4357",
            description: "Treatment referral and information service"
        },
        {
            name: "Trans Lifeline",
            phone: "877-565-8860",
            description: "Support for transgender people in crisis"
        },
        {
            name: "LGBT National Hotline",
            phone: "1-888-843-4564",
            description: "Support for LGBTQ+ individuals"
        },
        {
            name: "National Domestic Violence Hotline",
            phone: "1-800-799-7233",
            description: "Support for domestic violence situations"
        }
    ]
};

export const therapyResources = {
    copingStrategies: [
        {
            name: "Deep Breathing",
            description: "4-7-8 breathing technique for immediate anxiety relief",
            instructions: "Breathe in for 4 counts, hold for 7, exhale for 8"
        },
        {
            name: "Grounding Exercise",
            description: "5-4-3-2-1 technique using your senses",
            instructions: "Name 5 things you see, 4 you hear, 3 you touch, 2 you smell, 1 you taste"
        },
        {
            name: "Progressive Muscle Relaxation",
            description: "Systematic tensing and relaxing of muscle groups",
            instructions: "Start with toes, tense for 5 seconds, then relax. Move up through your body"
        }
    ],
    safetyPlan: {
        warningSignsToWatch: [
            "Persistent sad or empty mood",
            "Loss of interest in activities",
            "Changes in sleep or appetite",
            "Increased substance use",
            "Talking about death or suicide"
        ],
        copingStrategies: [
            "Call a trusted friend or family member",
            "Practice breathing exercises",
            "Go for a walk or do light exercise",
            "Listen to calming music",
            "Write in a journal"
        ]
    }
}; 