import React from "react";
import Dialog from "@mui/material/Dialog";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import {
  Camera,
  Smartphone,
  Video,
  Radio,
  ArrowRight,
  Shield,
} from "lucide-react";
import { useDashboard } from "../context/DashboardContext";

export default function CameraSelectModal() {
  const { cameraModal, closeCameraModal, handleConfirmCameraAction } =
    useDashboard();

  if (!cameraModal?.open || !cameraModal?.device) {
    return null;
  }

  const { device, actionType } = cameraModal;
  const isRecordAction = actionType === "record";

  const handleSelectLens = (lens) => {
    handleConfirmCameraAction(lens);
  };

  return (
    <Dialog
      open={cameraModal.open}
      onClose={closeCameraModal}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          maxWidth: 430,
          width: "100%",
          background: "linear-gradient(180deg, #131929 0%, #0a0e1a 100%)",
          backdropFilter: "blur(24px)",
          border: isRecordAction
            ? "1px solid rgba(255, 23, 68, 0.4)"
            : "1px solid rgba(0, 229, 255, 0.4)",
          borderRadius: "24px",
          boxShadow: isRecordAction
            ? "0 28px 70px rgba(0, 0, 0, 0.95), 0 0 35px rgba(255, 23, 68, 0.2)"
            : "0 28px 70px rgba(0, 0, 0, 0.95), 0 0 35px rgba(0, 229, 255, 0.2)",
          overflow: "hidden",
          m: 2,
        },
      }}
    >
      {/* Padded Content Wrapper */}
      <Box sx={{ p: { xs: 2.5, sm: 3 }, display: "flex", flexDirection: "column" }}>
        {/* Header Area */}
        <Box sx={{ mb: 2.5 }}>
          {/* Top bar: Badge & Close Button */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              mb: 1.5,
            }}
          >
            <Box
              sx={{
                display: "inline-flex",
                alignItems: "center",
                gap: 0.8,
                px: 1.4,
                py: 0.5,
                borderRadius: "20px",
                background: isRecordAction
                  ? "rgba(255, 23, 68, 0.15)"
                  : "rgba(0, 229, 255, 0.15)",
                border: isRecordAction
                  ? "1px solid rgba(255, 23, 68, 0.4)"
                  : "1px solid rgba(0, 229, 255, 0.4)",
                color: isRecordAction ? "#ff5252" : "#00e5ff",
                fontSize: "0.7rem",
                fontWeight: 700,
                letterSpacing: "0.06em",
                fontFamily: '"JetBrains Mono", monospace',
              }}
            >
              {isRecordAction ? <Video size={13} /> : <Radio size={13} />}
              {isRecordAction ? "REMOTE RECORDING" : "LIVE SURVEILLANCE"}
            </Box>

            <IconButton
              onClick={closeCameraModal}
              size="small"
              sx={{
                color: "#94a3b8",
                width: 30,
                height: 30,
                borderRadius: "9px",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                bgcolor: "rgba(255, 255, 255, 0.03)",
                transition: "all 0.15s ease",
                "&:hover": {
                  color: "#fff",
                  bgcolor: "rgba(255, 255, 255, 0.1)",
                  borderColor: "rgba(255, 255, 255, 0.25)",
                },
              }}
            >
              <CloseIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Box>

          {/* Title and Target Device */}
          <Typography
            sx={{
              fontSize: "1.2rem",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.01em",
              lineHeight: 1.25,
            }}
          >
            Choose Camera Lens
          </Typography>
          <Typography sx={{ fontSize: "0.8rem", color: "#94a3b8", mt: 0.5 }}>
            Target:{" "}
            <span style={{ color: "#e2e8f0", fontWeight: 600 }}>
              {device.deviceName || device.model || "Unknown Device"}
            </span>
            <span style={{ color: "#64748b" }}>
              {" "}
              • {device.batteryLevel ? `${device.batteryLevel}%` : "Online"}
            </span>
          </Typography>
        </Box>

        {/* Cards Parent Container: distinct dark framed well with padding & visible borders */}
        <Box
          sx={{
            background: "rgba(0, 0, 0, 0.45)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "16px",
            p: 1.5,
            display: "flex",
            flexDirection: "column",
            gap: 1.2,
          }}
        >
          {/* Card 1: Back Camera */}
          <Box
            onClick={() => handleSelectLens("BACK")}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.6,
              borderRadius: "12px",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                background: "rgba(0, 229, 255, 0.08)",
                borderColor: "rgba(0, 229, 255, 0.5)",
                transform: "translateY(-1px)",
                boxShadow: "0 6px 20px rgba(0, 229, 255, 0.15)",
                "& .arrow-box-back": {
                  bgcolor: "#00e5ff",
                  color: "#060a11",
                  transform: "translateX(2px)",
                },
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "11px",
                  background: "rgba(0, 229, 255, 0.12)",
                  border: "1px solid rgba(0, 229, 255, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#00e5ff",
                  flexShrink: 0,
                }}
              >
                <Camera size={22} />
              </Box>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                  <Typography
                    sx={{ color: "#fff", fontWeight: 700, fontSize: "0.92rem" }}
                  >
                    Back Camera
                  </Typography>
                  <Box
                    sx={{
                      px: 0.8,
                      py: 0.15,
                      borderRadius: "4px",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      bgcolor: "rgba(0, 229, 255, 0.15)",
                      color: "#00e5ff",
                      border: "1px solid rgba(0, 229, 255, 0.3)",
                      fontFamily: '"JetBrains Mono", monospace',
                      letterSpacing: "0.04em",
                    }}
                  >
                    REAR
                  </Box>
                </Box>
                <Typography
                  sx={{ color: "#94a3b8", fontSize: "0.76rem", mt: 0.2 }}
                >
                  Primary sensor • Wide-angle room view
                </Typography>
              </Box>
            </Box>

            <Box
              className="arrow-box-back"
              sx={{
                width: 28,
                height: 28,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#94a3b8",
                transition: "all 0.2s ease",
                flexShrink: 0,
              }}
            >
              <ArrowRight size={14} />
            </Box>
          </Box>

          {/* Card 2: Front Camera */}
          <Box
            onClick={() => handleSelectLens("FRONT")}
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              p: 1.6,
              borderRadius: "12px",
              cursor: "pointer",
              background: "rgba(255, 255, 255, 0.03)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
              "&:hover": {
                background: "rgba(168, 85, 247, 0.08)",
                borderColor: "rgba(168, 85, 247, 0.5)",
                transform: "translateY(-1px)",
                boxShadow: "0 6px 20px rgba(168, 85, 247, 0.15)",
                "& .arrow-box-front": {
                  bgcolor: "#c084fc",
                  color: "#060a11",
                  transform: "translateX(2px)",
                },
              },
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
              <Box
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: "11px",
                  background: "rgba(168, 85, 247, 0.12)",
                  border: "1px solid rgba(168, 85, 247, 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#c084fc",
                  flexShrink: 0,
                }}
              >
                <Smartphone size={22} />
              </Box>
              <Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.8 }}>
                  <Typography
                    sx={{ color: "#fff", fontWeight: 700, fontSize: "0.92rem" }}
                  >
                    Front Camera
                  </Typography>
                  <Box
                    sx={{
                      px: 0.8,
                      py: 0.15,
                      borderRadius: "4px",
                      fontSize: "0.62rem",
                      fontWeight: 700,
                      bgcolor: "rgba(168, 85, 247, 0.15)",
                      color: "#c084fc",
                      border: "1px solid rgba(168, 85, 247, 0.3)",
                      fontFamily: '"JetBrains Mono", monospace',
                      letterSpacing: "0.04em",
                    }}
                  >
                    SELFIE
                  </Box>
                </Box>
                <Typography
                  sx={{ color: "#94a3b8", fontSize: "0.76rem", mt: 0.2 }}
                >
                  Display sensor • Screen face view
                </Typography>
              </Box>
            </Box>

            <Box
              className="arrow-box-front"
              sx={{
                width: 28,
                height: 28,
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "rgba(255, 255, 255, 0.05)",
                color: "#94a3b8",
                transition: "all 0.2s ease",
                flexShrink: 0,
              }}
            >
              <ArrowRight size={14} />
            </Box>
          </Box>
        </Box>

        {/* Footer Note */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.8,
            mt: 2.2,
          }}
        >
          <Shield size={13} color="#64748b" />
          <Typography sx={{ fontSize: "0.72rem", color: "#64748b" }}>
            Select camera to initiate silent operation immediately
          </Typography>
        </Box>
      </Box>
    </Dialog>
  );
}
