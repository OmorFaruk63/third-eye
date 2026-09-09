import React, { useState, useEffect } from "react";
import {
  Video,
  Play,
  Download,
  Trash2,
  ExternalLink,
  MapPin,
  Calendar,
  Smartphone,
  CheckCircle2,
  Info,
  Search,
  Check,
  X,
} from "lucide-react";
import { useDashboard, API_BASE_URL } from "../context/DashboardContext";

import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Pagination from "@mui/material/Pagination";
import Checkbox from "@mui/material/Checkbox";

export default function Recordings() {
  const {
    recordings,
    searchQuery,
    setSearchQuery,
    selectedRecordings,
    setSelectedRecordings,
    isDeleting,
    setSelectedVideo,
    toggleSelectRecording,
    handleSelectAllToggle,
    handleDeleteSelected,
    handleDeleteAllRecordings,
    handleDeleteRecording,
    formatSize,
    formatTimeAgo,
  } = useDashboard();

  const [qualityFilter, setQualityFilter] = useState("ALL"); // ALL, 720p, 480p, DRIVE
  const [videoPage, setVideoPage] = useState(1);
  const videosPerPage = 6;

  // Filter recordings by search and quality filter
  const filteredRecordings = recordings.filter((r) => {
    const matchesSearch =
      (r.deviceName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.deviceId || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.fileName || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (r.locationName || "").toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (qualityFilter === "720p") return (r.quality || "720p").includes("720");
    if (qualityFilter === "480p") return (r.quality || "").includes("480");
    if (qualityFilter === "DRIVE")
      return Boolean(r.driveFileId || r.driveViewLink);
    return true;
  });

  const totalVideoPages =
    Math.ceil(filteredRecordings.length / videosPerPage) || 1;
  const paginatedRecordings = filteredRecordings.slice(
    (videoPage - 1) * videosPerPage,
    videoPage * videosPerPage,
  );

  useEffect(() => {
    setVideoPage(1);
  }, [searchQuery, qualityFilter]);

  const allVisibleSelected =
    paginatedRecordings.length > 0 &&
    paginatedRecordings.every((r) => selectedRecordings.includes(r._id));

  // Friendly title generator
  const formatFriendlyTitle = (rec) => {
    if (rec.uploadedAt) {
      const d = new Date(rec.uploadedAt);
      const datePart = d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const timePart = d.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      return `Surveillance Clip • ${datePart}, ${timePart}`;
    }
    return rec.fileName;
  };

  return (
    <Box
      sx={{
        maxWidth: 1280,
        mx: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 3,
      }}
    >
      {/* Page Header */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Video size={22} color="#00e5ff" />
            <Typography variant="h5" sx={{ fontWeight: 700, color: "#fff" }}>
              Surveillance Video Archive
            </Typography>
            <Chip
              size="small"
              label={`${recordings.length} Videos`}
              sx={{
                background: "rgba(0,229,255,0.12)",
                border: "1px solid rgba(0,229,255,0.3)",
                color: "#00e5ff",
                fontWeight: 700,
              }}
            />
          </Box>
          <Typography
            variant="caption"
            sx={{ color: "text.secondary", display: "block", mt: 0.3 }}
          >
            High-definition surveillance captures preserved in Google Drive
          </Typography>
        </Box>

        {/* Search Bar */}
        <TextField
          size="small"
          placeholder="Filter device, location, file..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search size={16} color="#64748b" />
                </InputAdornment>
              ),
              endAdornment: searchQuery ? (
                <InputAdornment position="end">
                  <IconButton
                    size="small"
                    onClick={() => setSearchQuery("")}
                    sx={{ color: "#64748b" }}
                  >
                    <X size={14} />
                  </IconButton>
                </InputAdornment>
              ) : null,
            },
          }}
          sx={{ width: { xs: "100%", sm: 300 } }}
        />
      </Box>

      {/* Filter Chips & Gallery Toolbar */}
      <Card
        sx={{
          p: 2,
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 2,
        }}
      >
        {/* Left: Quality Filters */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Button
            size="small"
            variant={qualityFilter === "ALL" ? "contained" : "outlined"}
            onClick={() => setQualityFilter("ALL")}
            sx={{
              background:
                qualityFilter === "ALL"
                  ? "rgba(0,229,255,0.18)"
                  : "transparent",
              borderColor:
                qualityFilter === "ALL"
                  ? "rgba(0,229,255,0.4)"
                  : "rgba(255,255,255,0.1)",
              color: qualityFilter === "ALL" ? "#00e5ff" : "text.secondary",
            }}
          >
            All Recordings ({recordings.length})
          </Button>

          <Button
            size="small"
            variant={qualityFilter === "720p" ? "contained" : "outlined"}
            onClick={() => setQualityFilter("720p")}
            sx={{
              background:
                qualityFilter === "720p"
                  ? "rgba(0,229,255,0.18)"
                  : "transparent",
              borderColor:
                qualityFilter === "720p"
                  ? "rgba(0,229,255,0.4)"
                  : "rgba(255,255,255,0.1)",
              color: qualityFilter === "720p" ? "#00e5ff" : "text.secondary",
            }}
          >
            720p HD
          </Button>

          <Button
            size="small"
            variant={qualityFilter === "480p" ? "contained" : "outlined"}
            onClick={() => setQualityFilter("480p")}
            sx={{
              background:
                qualityFilter === "480p"
                  ? "rgba(0,229,255,0.18)"
                  : "transparent",
              borderColor:
                qualityFilter === "480p"
                  ? "rgba(0,229,255,0.4)"
                  : "rgba(255,255,255,0.1)",
              color: qualityFilter === "480p" ? "#00e5ff" : "text.secondary",
            }}
          >
            480p SD
          </Button>

          <Button
            size="small"
            variant={qualityFilter === "DRIVE" ? "contained" : "outlined"}
            onClick={() => setQualityFilter("DRIVE")}
            startIcon={<CheckCircle2 size={13} color="#00e676" />}
            sx={{
              background:
                qualityFilter === "DRIVE"
                  ? "rgba(0,230,118,0.18)"
                  : "transparent",
              borderColor:
                qualityFilter === "DRIVE"
                  ? "rgba(0,230,118,0.4)"
                  : "rgba(255,255,255,0.1)",
              color: qualityFilter === "DRIVE" ? "#00e676" : "text.secondary",
            }}
          >
            Drive Synced
          </Button>
        </Box>

        {/* Right: Batch Controls */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.5,
            flexWrap: "wrap",
            ml: "auto",
          }}
        >
          <Button
            size="small"
            variant="outlined"
            onClick={() =>
              handleSelectAllToggle(paginatedRecordings.map((r) => r._id))
            }
            disabled={paginatedRecordings.length === 0}
            startIcon={
              <Box
                sx={{
                  width: 14,
                  height: 14,
                  borderRadius: "4px",
                  border: "1.5px solid",
                  borderColor: allVisibleSelected ? "#00e5ff" : "#64748b",
                  background: allVisibleSelected ? "#00e5ff" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {allVisibleSelected && (
                  <Check size={10} color="#000" strokeWidth={3} />
                )}
              </Box>
            }
            sx={{
              borderColor: "rgba(255,255,255,0.1)",
              color:
                selectedRecordings.length > 0 ? "#00e5ff" : "text.secondary",
              fontSize: "0.75rem",
            }}
          >
            {selectedRecordings.length > 0
              ? `${selectedRecordings.length} Selected`
              : "Select Page"}
          </Button>

          {selectedRecordings.length > 0 && (
            <Button
              size="small"
              onClick={() => setSelectedRecordings([])}
              sx={{
                color: "#94a3b8",
                fontSize: "0.75rem",
                minWidth: 0,
                textDecoration: "underline",
              }}
            >
              Deselect
            </Button>
          )}

          {selectedRecordings.length > 0 && (
            <Button
              size="small"
              variant="contained"
              color="error"
              onClick={handleDeleteSelected}
              disabled={isDeleting}
              startIcon={<Trash2 size={13} />}
              sx={{ fontSize: "0.75rem", px: 1.5 }}
            >
              {isDeleting
                ? "Deleting..."
                : `Delete (${selectedRecordings.length})`}
            </Button>
          )}

          <Button
            size="small"
            variant="outlined"
            onClick={handleDeleteAllRecordings}
            disabled={isDeleting || recordings.length === 0}
            startIcon={<Trash2 size={13} />}
            sx={{
              borderColor: "rgba(255,23,68,0.3)",
              color: "#ff5252",
              background: "rgba(255,23,68,0.06)",
              fontSize: "0.75rem",
              "&:hover": {
                background: "rgba(255,23,68,0.15)",
                borderColor: "#ff1744",
              },
            }}
          >
            Delete All
          </Button>
        </Box>
      </Card>

      {/* Main Grid Content */}
      {filteredRecordings.length === 0 ? (
        <Card
          sx={{ p: 6, textAlign: "center", background: "rgba(16,23,38,0.6)" }}
        >
          <Video size={36} color="#64748b" style={{ margin: "0 auto 12px" }} />
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, color: "#fff" }}
          >
            No surveillance videos found
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", mt: 0.5, maxWidth: 380, mx: "auto" }}
          >
            {searchQuery || qualityFilter !== "ALL"
              ? "No recordings match your current filters. Try resetting search."
              : "Captured videos from client devices will stream into this gallery automatically."}
          </Typography>
          {(searchQuery || qualityFilter !== "ALL") && (
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setSearchQuery("");
                setQualityFilter("ALL");
              }}
              sx={{
                mt: 2,
                color: "#00e5ff",
                borderColor: "rgba(0,229,255,0.3)",
              }}
            >
              Reset Filters
            </Button>
          )}
        </Card>
      ) : (
        <>
          <Grid container spacing={2.5}>
            {paginatedRecordings.map((rec) => {
              const isSelected = selectedRecordings.includes(rec._id);

              return (
                <Grid size={{ xs: 12, sm: 6, lg: 4 }} key={rec._id}>
                  <Card
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      overflow: "hidden",
                      position: "relative",
                      border: isSelected
                        ? "1px solid #00e5ff"
                        : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: isSelected
                        ? "0 0 24px rgba(0,229,255,0.25)"
                        : "none",
                      "&:hover": {
                        borderColor: isSelected
                          ? "#00e5ff"
                          : "rgba(0,229,255,0.4)",
                        transform: "translateY(-2px)",
                      },
                      transition: "all 0.25s ease",
                    }}
                  >
                    {/* CCTV Viewport Preview */}
                    <Box
                      onClick={() => setSelectedVideo(rec)}
                      className="cctv-viewport"
                      sx={{
                        aspectRatio: "16/9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: "pointer",
                        position: "relative",
                        userSelect: "none",
                      }}
                    >
                      {/* Corner Brackets */}
                      <div className="cctv-bracket-tl" />
                      <div className="cctv-bracket-tr" />
                      <div className="cctv-bracket-bl" />
                      <div className="cctv-bracket-br" />
                      <div className="cctv-crosshair" />

                      {/* Selection Checkbox Badge */}
                      <Box
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelectRecording(rec._id);
                        }}
                        sx={{
                          position: "absolute",
                          top: 12,
                          left: 12,
                          zIndex: 10,
                          width: 28,
                          height: 28,
                          borderRadius: "8px",
                          border: isSelected
                            ? "1px solid #00e5ff"
                            : "1px solid rgba(255,255,255,0.25)",
                          background: isSelected
                            ? "#00e5ff"
                            : "rgba(0,0,0,0.6)",
                          color: isSelected ? "#000" : "transparent",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          boxShadow: isSelected
                            ? "0 0 10px rgba(0,229,255,0.5)"
                            : "none",
                          transition: "all 0.2s ease",
                          "&:hover": { borderColor: "#00e5ff" },
                        }}
                        title={
                          isSelected ? "Deselect recording" : "Select recording"
                        }
                      >
                        <Check
                          size={14}
                          strokeWidth={3}
                          style={{ opacity: isSelected ? 1 : 0 }}
                        />
                      </Box>

                      {/* Center Glowing Play Button */}
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          background: "#00e5ff",
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 0 20px rgba(0,229,255,0.5)",
                          zIndex: 4,
                          transition: "transform 0.2s ease",
                          "&:hover": { transform: "scale(1.1)" },
                        }}
                      >
                        <Play size={22} fill="#000" style={{ marginLeft: 2 }} />
                      </Box>

                      {/* Telemetry Badges */}
                      <Box
                        sx={{
                          position: "absolute",
                          bottom: 10,
                          left: 10,
                          zIndex: 5,
                          px: 1,
                          py: 0.3,
                          borderRadius: 1,
                          background: "rgba(0,0,0,0.8)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          fontSize: "0.625rem",
                          fontFamily: '"JetBrains Mono", monospace',
                          color: "#fff",
                          display: "flex",
                          alignItems: "center",
                          gap: 0.8,
                        }}
                      >
                        <Box
                          sx={{
                            width: 6,
                            height: 6,
                            borderRadius: "50%",
                            background: "#00e5ff",
                          }}
                        />
                        <span>{rec.quality || "720p HD"}</span>
                      </Box>

                      <Box
                        sx={{
                          position: "absolute",
                          bottom: 10,
                          right: 10,
                          zIndex: 5,
                          px: 1,
                          py: 0.3,
                          borderRadius: 1,
                          background: "rgba(0,0,0,0.8)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          fontSize: "0.625rem",
                          fontFamily: '"JetBrains Mono", monospace',
                          color: "#00e5ff",
                          fontWeight: 600,
                        }}
                      >
                        {formatSize(rec.fileSizeBytes)}
                      </Box>
                    </Box>

                    {/* Video Meta Body */}
                    <Box
                      sx={{
                        p: 2,
                        display: "flex",
                        flexDirection: "column",
                        flexGrow: 1,
                        justifyContent: "space-between",
                      }}
                    >
                      <Box>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "flex-start",
                            justifyContent: "space-between",
                            gap: 1,
                            mb: 1,
                          }}
                        >
                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography
                              variant="body2"
                              sx={{
                                fontWeight: 700,
                                color: "#fff",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                "&:hover": { color: "#00e5ff" },
                                cursor: "pointer",
                              }}
                              onClick={() => setSelectedVideo(rec)}
                              title={rec.fileName}
                            >
                              {rec.deviceName || "Android Device"}
                            </Typography>
                            <Typography
                              variant="caption"
                              sx={{
                                color: "#00e5ff",
                                fontFamily: "monospace",
                                display: "block",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatFriendlyTitle(rec)}
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: '"JetBrains Mono", monospace',
                              color: "text.secondary",
                              flexShrink: 0,
                            }}
                          >
                            {formatTimeAgo(rec.uploadedAt)}
                          </Typography>
                        </Box>

                        <Box
                          sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.8,
                            fontSize: "0.75rem",
                            color: "text.secondary",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Smartphone
                              size={13}
                              color="#00e5ff"
                              style={{ flexShrink: 0 }}
                            />
                            <Typography
                              variant="caption"
                              sx={{
                                color: "text.secondary",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              Unit ID:{" "}
                              <span
                                style={{
                                  fontFamily: "monospace",
                                  color: "#94a3b8",
                                }}
                              >
                                {rec.deviceId}
                              </span>
                            </Typography>
                          </Box>

                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <Calendar
                              size={13}
                              color="#00e676"
                              style={{ flexShrink: 0 }}
                            />
                            <Typography
                              variant="caption"
                              sx={{ color: "#cbd5e1", fontFamily: "monospace" }}
                            >
                              {new Date(rec.uploadedAt).toLocaleString(
                                undefined,
                                {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  second: "2-digit",
                                },
                              )}
                            </Typography>
                          </Box>

                          {rec.latitude && rec.longitude && (
                            <Box
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <a
                                href={`https://www.google.com/maps?q=${rec.latitude},${rec.longitude}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  color: "#00e5ff",
                                  textDecoration: "none",
                                }}
                              >
                                <MapPin size={13} style={{ flexShrink: 0 }} />
                                <Typography
                                  variant="caption"
                                  sx={{
                                    color: "#00e5ff",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {rec.locationName ||
                                    `${rec.latitude.toFixed(2)}, ${rec.longitude.toFixed(2)}`}
                                </Typography>
                              </a>
                            </Box>
                          )}

                          <Box sx={{ pt: 0.5 }}>
                            {rec.driveFileId ? (
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.8,
                                  color: "#00e676",
                                  fontSize: "0.75rem",
                                  fontWeight: 600,
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>Synced to Google Drive</span>
                              </Box>
                            ) : (
                              <Box
                                sx={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 0.8,
                                  color: "#f59e0b",
                                  fontSize: "0.75rem",
                                }}
                              >
                                <Info size={13} />
                                <span>Saved Locally on Server</span>
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>

                      {/* Card Actions Footer */}
                      <Box
                        sx={{
                          mt: 2,
                          pt: 1.5,
                          borderTop: "1px solid rgba(255,255,255,0.07)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 1,
                        }}
                      >
                        <Button
                          size="small"
                          variant="outlined"
                          startIcon={<Play size={12} fill="currentColor" />}
                          onClick={() => setSelectedVideo(rec)}
                          sx={{
                            fontSize: "0.75rem",
                            py: 0.4,
                            px: 1.5,
                            borderColor: "rgba(0,229,255,0.3)",
                            color: "#00e5ff",
                            background: "rgba(0,229,255,0.08)",
                            "&:hover": {
                              background: "rgba(0,229,255,0.18)",
                              borderColor: "#00e5ff",
                            },
                          }}
                        >
                          Play
                        </Button>

                        <Box
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          {rec.driveViewLink ? (
                            <Button
                              size="small"
                              variant="outlined"
                              component="a"
                              href={rec.driveViewLink}
                              target="_blank"
                              rel="noreferrer"
                              startIcon={<ExternalLink size={12} />}
                              sx={{
                                fontSize: "0.75rem",
                                py: 0.4,
                                px: 1.2,
                                borderColor: "rgba(0,230,118,0.3)",
                                color: "#00e676",
                                background: "rgba(0,230,118,0.08)",
                                "&:hover": {
                                  background: "rgba(0,230,118,0.18)",
                                  borderColor: "#00e676",
                                },
                              }}
                            >
                              Drive
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              variant="outlined"
                              component="a"
                              href={`${API_BASE_URL}/api/videos/download/${rec._id}`}
                              download
                              startIcon={<Download size={12} />}
                              sx={{
                                fontSize: "0.75rem",
                                py: 0.4,
                                px: 1.2,
                                borderColor: "rgba(255,255,255,0.1)",
                                color: "#cbd5e1",
                                background: "rgba(255,255,255,0.04)",
                                "&:hover": {
                                  background: "rgba(255,255,255,0.08)",
                                  color: "#fff",
                                },
                              }}
                            >
                              Download
                            </Button>
                          )}

                          <IconButton
                            size="small"
                            onClick={() => handleDeleteRecording(rec._id)}
                            title="Delete Video"
                            sx={{
                              color: "#64748b",
                              "&:hover": {
                                color: "#ff5252",
                                background: "rgba(255,23,68,0.1)",
                              },
                            }}
                          >
                            <Trash2 size={14} />
                          </IconButton>
                        </Box>
                      </Box>
                    </Box>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          {/* Pagination Controls */}
          {filteredRecordings.length > videosPerPage && (
            <Card
              sx={{
                p: 2,
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                alignItems: "center",
                justifyContent: "space-between",
                gap: 2,
              }}
            >
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", fontFamily: "monospace" }}
              >
                Showing {(videoPage - 1) * videosPerPage + 1} -{" "}
                {Math.min(videoPage * videosPerPage, filteredRecordings.length)}{" "}
                of {filteredRecordings.length} recordings
              </Typography>
              <Pagination
                count={totalVideoPages}
                page={videoPage}
                onChange={(_, page) => setVideoPage(page)}
                size="small"
                showFirstButton
                showLastButton
              />
            </Card>
          )}
        </>
      )}
    </Box>
  );
}
