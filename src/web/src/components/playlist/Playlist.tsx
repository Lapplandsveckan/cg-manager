import React from 'react';
import { arrayMove, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { PlayListItem } from './PlaylistItem';
import { useState } from 'react';
import {closestCorners, DndContext, DragEndEvent, UniqueIdentifier} from '@dnd-kit/core';

export interface IPlaylistItem{
  id: string;
  title: string;
}

const initialPlaylist = [
    { id: '1', title: 'PlaylistItem' },
    { id: '2', title: 'PlaylistItem2' },
    { id: '3', title: 'PlaylistItem3' },
    { id: '4', title: 'PlaylistItem4' },
    { id: '5', title: 'PlaylistItem5' },
    { id: '6', title: 'PlaylistItem6' },
    { id: '7', title: 'PlaylistItem7' },
    { id: '8', title: 'PlaylistItem8' },
] as IPlaylistItem[];

export const PlayList = () => {
    const [playlist, setPlaylist] = useState(initialPlaylist);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (active.id === over.id) return;

        setPlaylist(tasks => {
            const getItemPos = (id: UniqueIdentifier) => playlist.findIndex(task => task.id === id);
            return arrayMove(tasks, getItemPos(active.id), getItemPos(over.id));
        });
    };

    return (
        <div className="flexbox justify-center items-center">
            <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
                <SortableContext items={playlist} strategy={verticalListSortingStrategy}>
                    {playlist.map(task => (
                        <PlayListItem id={task.id} title={task.title} key={task.id} />
                    ))}
                </SortableContext>
            </DndContext>
        </div>
    );
};


