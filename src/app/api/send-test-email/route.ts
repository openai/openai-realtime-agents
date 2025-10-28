import { NextResponse } from "next/server";
import { sendTestEmail } from "@/app/lib/email";

export async function POST() {
  try {
    const emailResult = await sendTestEmail("aurelien.borst@gmail.com");

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        messageId: emailResult.messageId,
        message: "Email de test envoyé avec succès",
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Erreur lors de l'envoi de l'email de test:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      },
      { status: 500 }
    );
  }
}
