import { useState } from "react";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    InputAdornment,
    IconButton
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { open } from "@tauri-apps/plugin-dialog";
import { createNewProject } from "../../utils/projectManager";
import { ProjectMetadata } from "../../utils/types";

interface Props {
    open: boolean;
    onClose: () => void;
    onProjectCreated: (project: ProjectMetadata) => void;
}

export default function CreateProjectDialog({ open: isOpen, onClose, onProjectCreated }: Props) {
    const [projectName, setProjectName] = useState("");
    const [savePath, setSavePath] = useState("");
    const [error, setError] = useState<string | null>(null);

    const handleBrowse = async () => {
        try {
            const selected = await open({
                directory: true,
                multiple: false,
                defaultPath: await import("@tauri-apps/api/path").then(p => p.documentDir())
            });

            if (selected && typeof selected === "string") {
                setSavePath(selected);
            }
        } catch (err) {
            console.error("Failed to select directory", err);
        }
    };

    const handleCreate = () => {
        if (!projectName.trim()) {
            setError("Project Name is required");
            return;
        }
        if (!savePath) {
            setError("Please select a save location");
            return;
        }

        const project = createNewProject(projectName, savePath);
        onProjectCreated(project);
        // Reset and close is handled by parent or effect, but good to reset logic here
        setProjectName("");
        setSavePath("");
        setError(null);
    };

    return (
        <Dialog open={isOpen} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Create New Project</DialogTitle>
            <DialogContent>
                <Box display="flex" flexDirection="column" gap={3} pt={1}>
                    <TextField
                        label="Project Name"
                        fullWidth
                        value={projectName}
                        onChange={(e) => setProjectName(e.target.value)}
                        error={!!error && !projectName.trim()}
                        autoFocus
                    />

                    <TextField
                        label="Save Location"
                        fullWidth
                        value={savePath}
                        InputProps={{
                            readOnly: true,
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton onClick={handleBrowse} edge="end">
                                        <FolderOpenIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                        error={!!error && !savePath}
                        helperText={error || "All project files will be saved here"}
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} color="inherit">
                    Cancel
                </Button>
                <Button onClick={handleCreate} variant="contained" disabled={!projectName || !savePath}>
                    Create Project
                </Button>
            </DialogActions>
        </Dialog>
    );
}
