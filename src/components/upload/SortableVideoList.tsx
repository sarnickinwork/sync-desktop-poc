
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Box } from '@mui/material';
import { VideoItem } from '../../utils/types';
import { SortableVideoItem } from './SortableVideoItem';

interface Props {
    items: VideoItem[];
    onReorder: (items: VideoItem[]) => void;
    onRemove: (id: string) => void;
}

export default function SortableVideoList({ items, onReorder, onRemove }: Props) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    function handleDragEnd(event: DragEndEvent) {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            const oldIndex = items.findIndex((item) => item.id === active.id);
            const newIndex = items.findIndex((item) => item.id === over.id);

            onReorder(arrayMove(items, oldIndex, newIndex));
        }
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
        >
            <SortableContext
                items={items.map(item => item.id)}
                strategy={verticalListSortingStrategy}
            >
                <Box sx={{ mt: 2 }}>
                    {items.map((item) => (
                        <SortableVideoItem
                            key={item.id}
                            item={item}
                            onRemove={onRemove}
                        />
                    ))}
                </Box>
            </SortableContext>
        </DndContext>
    );
}
