import { NextRequest, NextResponse } from "next/server";
import { sendCallbackEmail } from "@/app/lib/email";
import { companyInfo } from "@/app/agentConfigs/real-estate-agent/constants";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { collaboratorName, clientName, clientPhone, clientEmail, message } =
      body;

    // Validation
    if (
      !collaboratorName ||
      !clientName ||
      !clientPhone ||
      !clientEmail ||
      !message
    ) {
      return NextResponse.json(
        { error: "Tous les champs sont requis" },
        { status: 400 }
      );
    }

    // Trouver l'email du collaborateur
    const collaborator = companyInfo.team.find((m) =>
      m.name.toLowerCase().includes(collaboratorName.toLowerCase())
    );

    if (!collaborator) {
      return NextResponse.json(
        { error: `Collaborateur "${collaboratorName}" non trouvé` },
        { status: 404 }
      );
    }

    // Envoyer l'email
    const emailResult = await sendCallbackEmail({
      collaboratorEmail: collaborator.email,
      collaboratorName: collaborator.name,
      clientName,
      clientPhone,
      clientEmail,
      message,
    });

    if (emailResult.success) {
      return NextResponse.json({
        success: true,
        requestId: `CALLBACK-${Date.now()}`,
        messageId: emailResult.messageId,
        collaborator: collaboratorName,
        collaboratorEmail: collaborator.email,
        confirmation: `Votre demande de rappel a été envoyée par email à ${collaboratorName} (${collaborator.email}). Vous serez contacté au ${clientPhone} dans les plus brefs délais.`,
      });
    } else {
      return NextResponse.json(
        {
          success: false,
          error: emailResult.error,
          confirmation: `Désolé, une erreur s'est produite lors de l'envoi de l'email. Veuillez contacter directement ${collaboratorName} au ${collaborator.phone}.`,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Erreur API send-callback:", error);
    return NextResponse.json(
      { error: "Erreur serveur interne" },
      { status: 500 }
    );
  }
}
