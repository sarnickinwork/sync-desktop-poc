
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Box, Typography, IconButton, Paper } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import { VideoItem } from '../../utils/types';

interface Props {
    item: VideoItem;
    onRemove: (id: string) => void;
}

export function SortableVideoItem({ item, onRemove }: Props) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        marginBottom: 8,
    };

    return (
        <Paper
            ref={setNodeRef}
            style={style}
            variant="outlined"
            sx={{
                p: 2,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                bgcolor: 'background.paper',
                '&:hover': {
                    bgcolor: 'action.hover',
                },
            }}
        >
            <Box
                {...attributes}
                {...listeners}
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'grab',
                    color: 'text.secondary',
                    '&:active': { cursor: 'grabbing' },
                }}
            >
                <DragIndicatorIcon />
            </Box>

            <Box flex={1} overflow="hidden">
                <Typography noWrap fontWeight={500}>
                    {item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap display="block">
                    {item.path}
                </Typography>
            </Box>

            <IconButton size="small" onClick={() => onRemove(item.id)} color="error">
                <DeleteIcon />
            </IconButton>
        </Paper>
    );
}
