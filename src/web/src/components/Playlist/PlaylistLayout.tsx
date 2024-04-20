import React from "react";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../ui/resizable";
import { PlayList } from "./Playlist";


export const PlaylistLayout = () => {
  return (

    <div className='h-full w-full -m-4'>

      <ResizablePanelGroup direction="horizontal" className='flex justify-items-stretch'>
        <ResizablePanel defaultSize={10} minSize={10} className='flex justify-center items-center'>
          <div className="flex h-full items-center justify-center p-6">
            <span className="font-semibold text-sm hover:text-base">One</span>
          </div>
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel defaultSize={50} minSize={20} >
            <PlayList />
        </ResizablePanel>
        <ResizableHandle />

        <ResizablePanel defaultSize={20}>
          <ResizablePanelGroup direction="vertical">
            <ResizablePanel defaultSize={25}>
              <div className="flex h-full items-center justify-center p-6">
                <span className="font-semibold">Three</span>
              </div>
            </ResizablePanel>
            <ResizableHandle />
            <ResizablePanel>
              <div className="flex h-full items-center justify-center p-6">
                <span className="font-semibold">Four</span>
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>

  );
};