import { Box, Typography, Card, CardContent, Chip, List, ListItem, ListItemIcon, ListItemText, IconButton } from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import SubtitlesIcon from '@mui/icons-material/Subtitles';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import EditIcon from '@mui/icons-material/Edit';
import { MediaFile } from '../../hooks/usePackageImport';

type Props = {
    mediaFiles: MediaFile[];
    projectPath: string;
};

export default function MediaFilesList({ mediaFiles, projectPath }: Props) {
    const mp4Files = mediaFiles.filter((f) => f.type === 'mp4');
    const smiFiles = mediaFiles.filter((f) => f.type === 'smi');

    return (
        <Box mt={4}>
            <Typography variant="h6" gutterBottom fontWeight={600}>
                Recognized Media Files
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
                Found in: {projectPath}/media
            </Typography>

            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
                {/* MP4 Files */}
                <Card variant="outlined">
                    <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <MovieIcon color="primary" />
                            <Typography variant="subtitle1" fontWeight={600}>
                                Video Files
                            </Typography>
                            <Chip label={mp4Files.length} size="small" color={mp4Files.length > 0 ? "success" : "default"} />
                        </Box>

                        {mp4Files.length > 0 ? (
                            <List dense>
                                {mp4Files.map((file) => (
                                    <ListItem key={file.path}>
                                        <ListItemIcon>
                                            <CheckCircleIcon color="success" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={file.name}
                                            primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                No .mp4 files found
                            </Typography>
                        )}
                    </CardContent>
                </Card>

                {/* SMI Files */}
                <Card variant="outlined">
                    <CardContent>
                        <Box display="flex" alignItems="center" gap={1} mb={2}>
                            <SubtitlesIcon color="secondary" />
                            <Typography variant="subtitle1" fontWeight={600}>
                                Subtitle Files
                            </Typography>
                            <Chip label={smiFiles.length} size="small" color={smiFiles.length > 0 ? "success" : "default"} />
                        </Box>

                        {smiFiles.length > 0 ? (
                            <List dense>
                                {smiFiles.map((file) => (
                                    <ListItem
                                        key={file.path}
                                        secondaryAction={
                                            <IconButton edge="end" aria-label="edit" size="small">
                                                <EditIcon />
                                            </IconButton>
                                        }
                                    >
                                        <ListItemIcon>
                                            <CheckCircleIcon color="success" fontSize="small" />
                                        </ListItemIcon>
                                        <ListItemText
                                            primary={file.name}
                                            primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        ) : (
                            <Typography variant="body2" color="text.secondary" fontStyle="italic">
                                No .smi files found
                            </Typography>
                        )}
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
