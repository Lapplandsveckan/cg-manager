import React from "react";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { PlayListItem } from "./PlaylistItem";
import { useState } from "react";
import { closestCorners, DndContext } from "@dnd-kit/core";

export interface PlayListItemInterface {
  id: string;
  title: string;
}

const initialPlayList = [
  { id: "1", title: "PlaylistItem" },
  { id: "2", title: "PlaylistItem2" },
  { id: "3", title: "PlaylistItem3" },
  { id: "4", title: "PlaylistItem4" },
  { id: "5", title: "PlaylistItem5" },
  { id: "6", title: "PlaylistItem6" },
  { id: "7", title: "PlaylistItem7" },
  { id: "8", title: "PlaylistItem8" },
];

export const PlayList = () => {
  const [tasks, setPlayList] = useState(initialPlayList);


  const getTaskPos = id => tasks.findIndex(task => task.id === id)

  const handleDragEnd = event => {
    const { active, over } = event

    if (active.id === over.id) return;

    setPlayList(tasks => {
      const originalPos = getTaskPos(active.id)
      const newPos = getTaskPos(over.id)

      return arrayMove(tasks, originalPos, newPos)
    })
  }

  return (
    <div className="flexbox justify-center items-center">
      <DndContext onDragEnd={handleDragEnd} collisionDetection={closestCorners}>
        <SortableContext items={tasks} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <PlayListItem id={task.id} title={task.title} key={task.id} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}


