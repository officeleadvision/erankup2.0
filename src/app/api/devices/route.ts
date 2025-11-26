import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Device from "@/models/Device";
import { logActivity } from "@/lib/activityLogger";
import randtoken from "rand-token";

export async function POST(request: NextRequest) {
  try {
    await dbConnect();

    const allHeaders: { [key: string]: string } = {};
    request.headers.forEach((value, key) => {
      allHeaders[key] = value;
    });

    const userId = request.headers.get("x-user-id");
    const username = request.headers.get("x-user-username");
    const login = request.headers.get("x-user-login") || username || "unknown";

    if (!userId || !username) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required: User details not found in token.",
        },
        { status: 401 }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request: Could not parse JSON body.",
        },
        { status: 400 }
      );
    }

    const { label, location } = body;

    if (!label || !location) {
      return NextResponse.json(
        {
          success: false,
          message: "Label and location are required for the device.",
        },
        { status: 400 }
      );
    }

    let deviceToken = randtoken.generate(8);
    let existingDeviceWithToken = await Device.findOne({ token: deviceToken });
    while (existingDeviceWithToken) {
      deviceToken = randtoken.generate(8);
      existingDeviceWithToken = await Device.findOne({ token: deviceToken });
    }

    const newDevice = new Device({
      owner: username,
      label,
      location,
      token: deviceToken,
      dateOfPlacement: new Date(),
    });

    await newDevice.save();

    await logActivity({
      account: username,
      performedBy: login,
      entityType: "device",
      action: "create",
      status: "success",
      message: "Device created successfully",
      entityId: String(newDevice._id),
      entityName: label,
      metadata: {
        label,
        location,
        token: deviceToken,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: "Device created successfully",
        device: newDevice,
      },
      { status: 201 }
    );
  } catch (error) {
    let errorMessage = "Error creating device";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    await dbConnect();

    const userId = request.headers.get("x-user-id");
    const username = request.headers.get("x-user-username");

    if (!userId || !username) {
      return NextResponse.json(
        {
          success: false,
          message: "Authentication required: User details not found in token.",
        },
        { status: 401 }
      );
    }

    const devices = await Device.find({ owner: username }).sort({
      dateOfPlacement: -1,
    });

    return NextResponse.json({ success: true, devices }, { status: 200 });
  } catch (error) {
    let errorMessage = "Error fetching devices";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
