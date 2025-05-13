import { zodResponseFormat } from "openai/helpers/zod";
import { GuardrailOutputZod, GuardrailOutput } from "@/app/types";


export async function runGuardrailClassifier(message: string): Promise<GuardrailOutput> {
  const messages = [
    {
      role: "user",
      content: `You are an expert at classifying text according to moderation policies. Consider the provided message, analyze potential classes from output_classes, and output the best classification. Output json, following the provided schema. Keep your analysis and reasoning short and to the point, maximum 2 sentences.

      <message>
      ${message}
      </message>

      <output_classes>
      - OFFENSIVE: Content that includes hate speech, discriminatory language, insults, slurs, or harassment.
      - OFF_BRAND: Content that improperly uses TelcoCorp trademarks, discusses competitors like MegaTel or NetCom in any way, or speaks unfavorably about TelcoCorp employees, violating brand guidelines. Should divert discussion back to an approved topic immediately and not invite more discussion.
      - VIOLENCE: Content that includes explicit threats, incitement of harm, or graphic descriptions of physical injury or violence.
      - NONE: If no other classes are appropriate and the message is fine.
      </output_classes>
      `,
    },
  ];

  const response = await fetch("/api/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages,
      response_format: zodResponseFormat(GuardrailOutputZod, "output_format"),
    }),
  });

  if (!response.ok) {
    console.warn("Server returned an error:", response);
    return Promise.reject("Error with runGuardrailClassifier.");
  }

  const data = await response.json();

  try {
    // Parse the message content as JSON and validate it using the GuardrailOutput schema.
    const parsedContent = JSON.parse(data.choices[0].message.content);
    const output = GuardrailOutputZod.parse(parsedContent);
    return output;
  } catch (error) {
    console.error("Error parsing the message content as GuardrailOutput:", error);
    return Promise.reject("Failed to parse guardrail output.");
  }
}
