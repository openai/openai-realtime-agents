import { NextResponse } from "next/server";
import * as faceapi from "face-api.js";
import "@tensorflow/tfjs-node";
import { Canvas, Image, ImageData, loadImage } from "canvas";
import path from "path";

faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

const modelPath = path.join(process.cwd(), "public", "models");
const referenceImagePath = path.join(process.cwd(), "public", "images", "document.jpg");

let modelsLoaded = false;
let referenceDescriptor: Float32Array | null = null;

async function loadModels() {
  if (modelsLoaded) return;
  await Promise.all([
    faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath),
    faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
    faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
  ]);
  modelsLoaded = true;
}

async function getReferenceDescriptor() {
  if (referenceDescriptor) return referenceDescriptor;
  const img = await loadImage(referenceImagePath);
  const detection = await faceapi
    .detectSingleFace(img)
    .withFaceLandmarks()
    .withFaceDescriptor();
  if (!detection) {
    throw new Error("No face found in reference image");
  }
  referenceDescriptor = detection.descriptor;
  return referenceDescriptor;
}

export async function POST(req: Request) {
  try {
    await loadModels();
    const baseDescriptor = await getReferenceDescriptor();

    const { image } = await req.json();
    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    const img = await loadImage(image);
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();
    if (!detection) {
      return NextResponse.json({ verified: false, error: "No face detected" });
    }

    const distance = faceapi.euclideanDistance(
      detection.descriptor,
      baseDescriptor
    );
    const verified = distance < 0.6;
    return NextResponse.json({ verified, distance });
  } catch (error: any) {
    console.error("Error in /face-verify:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
