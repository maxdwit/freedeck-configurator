import React, { useEffect, useState } from "react";
import styled from "styled-components";

import { Button, FDButton } from "./components/lib/button";
import { File } from "./components/lib/file";
import { Page } from "./components/Page";
import { HEADER_SIZE, ROW_SIZE } from "./constants";
import { colors } from "./definitions/colors";
import { BACK_IMAGE } from "./definitions/defaultBackImage";
import defaultRowBuffer from "./definitions/defaultRowBuffer";
import { optimizeForSSD1306 } from "./lib/convertFile";
import { download } from "./lib/download";
import { handleFileSelect } from "./lib/fileSelect";
import { parseConfig } from "./lib/parse/parseConfig";

const Main = styled.div`
  * {
    box-sizing: border-box;
  }
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
`;

const Header = styled.div`
  background-color: ${colors.gray};
  border-bottom: 1px solid ${colors.black}; 
  display: grid;
  grid-template-columns: 200px 1fr;
  align-items: center;
  padding: 18px;
`;

const HeadLine = styled.div`
  color: white;
  font-family: sans-serif;
  font-size: 36px;
  font-weight: bold;
`

const Buttons = styled.div`
  display: flex;
  height: 52px;
  justify-content: space-between;
`

const Horiz = styled.div`
  display: flex;
  align-items: center;
`;

const Content = styled.div`
  background-color: ${colors.gray};
  display: flex;
  flex-wrap: wrap;
  justify-content: space-around;
  align-items: center;
  overflow: auto;
  width: 100%;
  height: 100%;
`;

const LoadConfigFileInner = styled.label`
  user-select: none;
  font-size: 24px;
  padding: 8px;
  font-family: sans-serif;
  font-weight: bold;
  position: relative;
  width: auto;
  color: #ecf0f1;
  text-decoration: none;
  border-radius: 5px;
  border: solid 1px ${colors.accent};
  background: ${colors.accentDark};
  text-align: center;
  /* padding: 16px 18px 14px; */
  transition: all 0.1s;
  box-shadow: 0px 0px 0px, 0px 0px 0px, 0px 6px 0px ${colors.accentDark},
    0px 0px 0px;
  cursor: pointer;
`

const LoadConfigFile = styled.div`
  transition: all 0.05s;
  padding-bottom: 6px;
  :hover {
    padding-top: 4px;
    padding-bottom: 2px;
  }
  &:hover ${LoadConfigFileInner} {
    box-shadow: 0px 0px 0px, 0px 0px 0px, 0px 2px 0px ${colors.accentDark},
    0px 0px 0px;
  }

  :active {
    padding-top: 6px;
    padding-bottom: 0px;
  }
  &:active ${LoadConfigFileInner} {
    box-shadow: none;
  }
`

const InvisibleFile = styled.input.attrs({ type: "file"})`
  display: none;
`

const SaveConfigFile = styled(FDButton)`
`

const AddPage = styled(FDButton)`
`

export interface IConfig {
  width: number;
  height: number;
  pages: number;
  images: Buffer[];
}

function App() {
  const [height, setHeight] = useState<number>(2);
  const [width, setWidth] = useState<number>(3);
  const [pageBuffers, setPageBuffers] = useState<Buffer[]>([]);
  const [imageBuffers, setImageBuffers] = useState<Buffer[]>([]);

  const setImage = (
    newImage: Buffer,
    pageIndex: number,
    displayIndex: number
  ) => {
    const newImages = [...imageBuffers];
    newImages[width * height * pageIndex + displayIndex] = newImage;
    setImageBuffers(newImages);
  };

  const setRow = (
    newRow: number[],
    pageIndex: number,
    displayIndex: number
  ) => {
    const newPageBuffers = [...pageBuffers];
    const newPage = newPageBuffers[pageIndex];
    while (newRow.length < ROW_SIZE) {
      newRow.push(0);
    }
    newPage.set(newRow, displayIndex * ROW_SIZE);
    setPageBuffers(newPageBuffers);
  };

  const deletePage = (pageIndex: number) => {
    const pageSize = width * height;

    const newImages = [...imageBuffers];
    newImages.splice(pageSize * pageIndex, pageSize);
    setImageBuffers(newImages);

    const newPages = [...pageBuffers];
    newPages.splice(pageIndex, 1);
    newPages.forEach((newPage) => {
        for (let i = 0; i < width * height; i++) {
          if (newPage.readUInt8(i * ROW_SIZE) === 1) {
            const oldValue = newPage.readUInt8(i * ROW_SIZE + 1);
            if (oldValue >= pageIndex) {
              const newValue = Math.max(oldValue - 1,0)
              newPage.set([newValue],i * ROW_SIZE + 1);
            }
          }
        }
    });
    setPageBuffers(newPages);
  };

  const loadConfigFile = (configFile: File) =>
    handleFileSelect(configFile).then(arrayBuffer => {
      const config = parseConfig(Buffer.from(arrayBuffer));
      setHeight(config.height);
      setWidth(config.width);
      setPageBuffers(config.pages);
      //setPageCount(config.pageCount);
      setImageBuffers(config.images);
    });

    const addPage = (previousPageIndex: number) => {
      setPageBuffers([...pageBuffers, defaultRowBuffer(width, height, previousPageIndex)]);
      const blankImages: Buffer[] = Array(width * height-1).fill(
        new Buffer(1024)
      );
      setImageBuffers([...imageBuffers, BACK_IMAGE ,...blankImages]);
      return pageBuffers.length
    }

  return (
    <Main>
      <Header id="header">
        <HeadLine>FreeDeck</HeadLine>
        <Buttons>

        <form
          onSubmit={event => {
            event.preventDefault();
          }}
          >
          <Horiz>
            <LoadConfigFile><LoadConfigFileInner htmlFor="loadConfig">Load Config</LoadConfigFileInner></LoadConfigFile>
            <InvisibleFile

              id="loadConfig"
              onChange={async event => {
                if (event.target.files?.length) {
                  loadConfigFile(event.target.files[0]);
                }
              }}
              ></InvisibleFile>
            <SaveConfigFile
              ml={16}
              size={3}
              onClick={() => {
                const header = new Buffer(HEADER_SIZE);
                header.writeUInt8(3, 0);
                header.writeUInt8(2, 1);
                const offset = pageBuffers.length * width * height + 1;
                header.writeUInt16LE(offset, 2);
                const newConfig = Buffer.concat([
                  header,
                  ...pageBuffers,
                  ...(imageBuffers).map(imageBuffer => optimizeForSSD1306(imageBuffer))
                ]);
                download(newConfig);
              }}
              >
              Save Config
            </SaveConfigFile>
          </Horiz>
        </form>
        <Horiz>
          <AddPage
            onClick={() => {
              addPage(-1)
            }}
          >
            Add Page +
          </AddPage>
          
        </Horiz>
      </Buttons>
      </Header>
      <Content id="pages">
        {pageBuffers?.map((page, index) => (
          <Page
          height={height}
          width={width}
          pageIndex={index}
          images={imageBuffers}
          page={page}
          key={index}
            setImage={setImage}
            setRow={setRow}
            deletePage={deletePage}
            pageCount={pageBuffers.length}
          addPage={() => addPage(index)}
          />
        ))}
      </Content>
    </Main>
  );
}

export default App;
