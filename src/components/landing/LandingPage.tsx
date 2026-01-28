import { useState, useEffect } from "react";
import {
    Box,
    Typography,
    Button,
    Grid,
    Card,
    CardContent,
    CardActions,
    IconButton,
    Tooltip,
    useTheme,
    alpha,
    Container,
    Chip
} from "@mui/material";

import AddIcon from "@mui/icons-material/Add";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import AccessTimeIcon from "@mui/icons-material/AccessTime";

import CreateProjectDialog from "./CreateProjectDialog";
import { getProjects, deleteProject } from "../../utils/projectManager";
import { ProjectMetadata } from "../../utils/types";
import ThemeToggle from "../ThemeToggle";

interface Props {
    onProjectSelect: (projectId: string) => void;
    onNavigateToImport: () => void;
}

export default function LandingPage({ onProjectSelect, onNavigateToImport }: Props) {
    const theme = useTheme();
    const [projects, setProjects] = useState<ProjectMetadata[]>([]);
    const [isCtxOpen, setIsCtxOpen] = useState(false);

    const refreshProjects = () => {
        setProjects(getProjects());
    };

    useEffect(() => {
        refreshProjects();
    }, []);

    const handleDelete = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("Are you sure you want to delete this project?")) {
            deleteProject(id);
            refreshProjects();
        }
    };

    return (
        <Box minHeight="100vh" bgcolor="background.default">
            {/* HEADER */}
            <Box
                py={4}
                px={6}
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                bgcolor={theme.palette.mode === 'light' ? 'white' : 'background.paper'}
                borderBottom={1}
                borderColor="divider"
            >
                <Typography variant="h4" fontWeight={800} sx={{
                    background: `linear-gradient(45deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent"
                }}>
                    SyncExpress Live
                </Typography>
                <Box display="flex" gap={2}>
                    <Button
                        variant="outlined"
                        startIcon={<FolderOpenIcon />}
                        onClick={onNavigateToImport}
                    >
                        Import Package
                    </Button>
                    <ThemeToggle />
                </Box>
            </Box>

            <Container maxWidth="lg" sx={{ mt: 6 }}>
                {/* ACTIONS */}
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                    <Typography variant="h5" fontWeight={700}>
                        My Projects
                    </Typography>
                    <Button
                        variant="contained"
                        size="large"
                        startIcon={<AddIcon />}
                        onClick={() => setIsCtxOpen(true)}
                        sx={{ px: 4, py: 1.5, borderRadius: 2 }}
                    >
                        Create New Project
                    </Button>
                </Box>

                {/* PROJECT LIST */}
                {projects.length === 0 ? (
                    <Box
                        display="flex"
                        flexDirection="column"
                        alignItems="center"
                        justifyContent="center"
                        py={10}
                        bgcolor={alpha(theme.palette.primary.main, 0.03)}
                        borderRadius={4}
                        border="1px dashed"
                        borderColor="divider"
                    >
                        <Typography variant="h6" color="text.secondary" gutterBottom>
                            No projects yet
                        </Typography>
                        <Typography color="text.tertiary" mb={3}>
                            Start by creating a new synchronization project
                        </Typography>
                        <Button variant="contained" onClick={() => setIsCtxOpen(true)}>
                            Create Project
                        </Button>
                    </Box>
                ) : (
                    <Grid container spacing={3}>
                        {projects.map((project) => (
                            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={project.id}>
                                <Card
                                    sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s',
                                        '&:hover': {
                                            transform: 'translateY(-4px)',
                                            boxShadow: 8,
                                            borderColor: 'primary.main',
                                        },
                                    }}
                                    variant="outlined"
                                    onClick={() => onProjectSelect(project.id)}
                                >
                                    <CardContent sx={{ flexGrow: 1 }}>
                                        <Box display="flex" justifyContent="space-between" mb={1}>
                                            <Chip
                                                label={project.status.toUpperCase()}
                                                size="small"
                                                color={project.status === 'active' ? 'success' : 'default'}
                                                variant="outlined"
                                                sx={{ fontSize: '0.7rem', height: 20 }}
                                            />
                                            <Tooltip title="Delete Project">
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => handleDelete(e, project.id)}
                                                    sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                                                >
                                                    <DeleteOutlineIcon fontSize="small" />
                                                </IconButton>
                                            </Tooltip>
                                        </Box>
                                        <Typography variant="h6" fontWeight={700} noWrap title={project.name} gutterBottom>
                                            {project.name}
                                        </Typography>
                                        <Typography variant="body2" color="text.secondary" noWrap title={project.savePath} sx={{ mb: 2 }}>
                                            {project.savePath}
                                        </Typography>

                                        <Box display="flex" alignItems="center" gap={0.5} color="text.disabled">
                                            <AccessTimeIcon sx={{ fontSize: 16 }} />
                                            <Typography variant="caption">
                                                Last modified: {new Date(project.lastModified).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                    </CardContent>
                                    <CardActions sx={{ p: 2, pt: 0 }}>
                                        <Button
                                            fullWidth
                                            variant="contained"
                                            color="primary"
                                            endIcon={<PlayArrowIcon />}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onProjectSelect(project.id);
                                            }}
                                        >
                                            Resume
                                        </Button>
                                    </CardActions>
                                </Card>
                            </Grid>
                        ))}
                    </Grid>
                )}
            </Container>

            {/* CREATE DIALOG */}
            <CreateProjectDialog
                open={isCtxOpen}
                onClose={() => setIsCtxOpen(false)}
                onProjectCreated={(project) => {
                    setIsCtxOpen(false);
                    refreshProjects();
                    onProjectSelect(project.id);
                }}
            />
        </Box>
    );
}
