import { NextRequest, NextResponse } from "next/server";
import dbConnect from "@/lib/mongodb";
import Device, { IDevice } from "@/models/Device";
import mongoose from "mongoose";

interface DeviceUpdateRequest {
  label?: string;
  location?: string;
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  const { deviceId } = params;
  try {
    await dbConnect();
    const username = request.headers.get("x-user-username");

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return NextResponse.json(
        { success: false, message: "Invalid device ID format." },
        { status: 400 }
      );
    }

    const { label, location }: Partial<DeviceUpdateRequest> =
      await request.json();

    if (!label && !location) {
      return NextResponse.json(
        {
          success: false,
          message:
            "At least one field (label or location) must be provided for update.",
        },
        { status: 400 }
      );
    }

    const updateData: Partial<IDevice> = {};
    if (label) updateData.label = label;
    if (location) updateData.location = location;

    const updatedDevice = await Device.findOneAndUpdate(
      { _id: deviceId, owner: username },
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!updatedDevice) {
      return NextResponse.json(
        {
          success: false,
          message: "Device not found or user not authorized to update.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Device updated successfully",
        device: updatedDevice,
      },
      { status: 200 }
    );
  } catch (error) {
    let errorMessage = "Error updating device";
    if (error instanceof mongoose.Error.ValidationError) {
      errorMessage = error.message;
      return NextResponse.json(
        { success: false, message: errorMessage },
        { status: 400 }
      );
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { deviceId: string } }
) {
  const { deviceId } = params;
  try {
    await dbConnect();
    const username = request.headers.get("x-user-username");

    if (!username) {
      return NextResponse.json(
        { success: false, message: "Authentication required." },
        { status: 401 }
      );
    }

    if (!mongoose.Types.ObjectId.isValid(deviceId)) {
      return NextResponse.json(
        { success: false, message: "Invalid device ID format." },
        { status: 400 }
      );
    }

    const deletedDevice = await Device.findOneAndDelete({
      _id: deviceId,
      owner: username,
    });

    if (!deletedDevice) {
      return NextResponse.json(
        {
          success: false,
          message: "Device not found or user not authorized to delete.",
        },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Device deleted successfully",
        device: deletedDevice,
      },
      { status: 200 }
    );
  } catch (error) {
    let errorMessage = "Error deleting device";
    if (error instanceof Error) {
      errorMessage = error.message;
    }
    return NextResponse.json(
      { success: false, message: errorMessage },
      { status: 500 }
    );
  }
}
