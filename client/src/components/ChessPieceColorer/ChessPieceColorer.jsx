import React, { useState, useRef, useEffect } from "react";
import styled from "styled-components";

const ColorerContainer = styled.div`
  position: absolute;
  top: 20px;
  left: 20px;
  width: 320px;
  background: white;
  border: 1px solid #ccc;
  border-radius: 8px;
  padding: 16px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  z-index: 1000;
  color: black;
`;

const ColorRow = styled.div`
  display: flex;
  align-items: center;
  margin-bottom: 12px;
`;

const Label = styled.label`
  font-size: 14px;
  margin-right: 10px;
  width: 120px;
`;

const ColorInput = styled.input`
  margin-right: 8px;
`;

const TextInput = styled.input`
  padding: 4px 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  width: 80px;
`;

const Title = styled.h3`
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
  font-weight: 600;
`;

const CanvasChessColorer = () => {
  const [blackColor, setBlackColor] = useState("#020617");
  const [whiteColor, setWhiteColor] = useState("#f4f4f5");
  const canvasRef = useRef(null);

  // Helper functions for color handling
  const isValidHex = (hex) => /^#([0-9A-F]{3}){1,2}$/i.test(hex);

  // Handle color input changes
  const handleColorChange = (color, setColor) => {
    // Ensure it starts with #
    let newColor = color.startsWith("#") ? color : `#${color}`;

    // For 3-digit hex, expand to 6 digits
    if (newColor.length === 4) {
      newColor = `#${newColor[1]}${newColor[1]}${newColor[2]}${newColor[2]}${newColor[3]}${newColor[3]}`;
    }

    // Validate before setting
    if (isValidHex(newColor)) {
      setColor(newColor);
    }
  };

  // Convert hex color to RGB components
  const hexToRgb = (hex) => {
    const r = parseInt(hex.substring(1, 3), 16);
    const g = parseInt(hex.substring(3, 5), 16);
    const b = parseInt(hex.substring(5, 7), 16);
    return [r, g, b];
  };

  // Apply the color mapping to all chess pieces on the page
  useEffect(() => {
    // Function to remap colors of an image
    const remapImageColors = (img) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      // Set canvas size to match image
      canvas.width = img.width;
      canvas.height = img.height;

      const ctx = canvas.getContext("2d");

      // Draw image to canvas
      ctx.drawImage(img, 0, 0);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Convert target colors to RGB
      const blackRgb = hexToRgb(blackColor);
      const whiteRgb = hexToRgb(whiteColor);

      // Process each pixel
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];

        // Skip transparent pixels
        if (a === 0) continue;

        // Calculate how "white" the pixel is (0-1)
        const whiteness = (r + g + b) / (255 * 3);

        // Linear interpolation between black and white colors
        data[i] = Math.round(
          blackRgb[0] * (1 - whiteness) + whiteRgb[0] * whiteness
        );
        data[i + 1] = Math.round(
          blackRgb[1] * (1 - whiteness) + whiteRgb[1] * whiteness
        );
        data[i + 2] = Math.round(
          blackRgb[2] * (1 - whiteness) + whiteRgb[2] * whiteness
        );
      }

      // Put the modified image data back on the canvas
      ctx.putImageData(imageData, 0, 0);

      // Return the new image as a data URL
      return canvas.toDataURL();
    };

    // Function to update all chess piece images
    const updateChessPieces = () => {
      const chessPieces = document.querySelectorAll(".chess-piece");
      chessPieces.forEach((piece) => {
        // Create a new image object for each piece
        const img = new Image();
        img.crossOrigin = "Anonymous";

        img.onload = () => {
          const newSrc = remapImageColors(img);
          piece.src = newSrc;
        };

        // Set source to the original image
        // We store the original src in a data attribute to avoid reapplying
        if (!piece.dataset.originalSrc) {
          piece.dataset.originalSrc = piece.src;
        }
        img.src = piece.dataset.originalSrc;
      });
    };

    // Call update when colors change, with a small delay to batch changes
    const timeoutId = setTimeout(updateChessPieces, 200);
    return () => clearTimeout(timeoutId);
  }, [blackColor, whiteColor]);

  return (
    <ColorerContainer>
      <Title>Chess Piece Color Mapper</Title>

      {/* Hidden canvas for image processing */}
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* Color Control UI */}
      <ColorRow>
        <Label>Black → New Color:</Label>
        <ColorInput
          type="color"
          value={blackColor}
          onChange={(e) => handleColorChange(e.target.value, setBlackColor)}
        />
        <TextInput
          type="text"
          value={blackColor}
          onChange={(e) => handleColorChange(e.target.value, setBlackColor)}
        />
      </ColorRow>

      <ColorRow>
        <Label>White → New Color:</Label>
        <ColorInput
          type="color"
          value={whiteColor}
          onChange={(e) => handleColorChange(e.target.value, setWhiteColor)}
        />
        <TextInput
          type="text"
          value={whiteColor}
          onChange={(e) => handleColorChange(e.target.value, setWhiteColor)}
        />
      </ColorRow>
    </ColorerContainer>
  );
};

export default CanvasChessColorer;
