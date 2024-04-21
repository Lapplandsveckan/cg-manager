import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { IPlaylistItem } from './Playlist';

export const PlayListItem: React.FC<IPlaylistItem> = ({ id, title }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id });

    const style = {
        transition,
        transform: CSS.Transform.toString(transform),
    };

    return (
        <div ref={setNodeRef} {...attributes} {...listeners} style={style} className="font-mono bg-slate-500/50 rounded-sm m-2">
            {title}
        </div>
    );
};
