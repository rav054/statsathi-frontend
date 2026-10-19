// Randomized field plans for the Field Layout Generator (CRD, RBD, Latin square, split-plot and sub-sub plot).
import { seededRandom, shuffleWith } from './seededRandom';

// A Latin square with its rows and columns randomly permuted
const latinSquare = (t, shuffle) => {
  let base = Array.from({ length: t }, (_, i) => i);
  let square = [];
  for (let r = 0; r < t; r++) {
    let row = [];
    for (let c = 0; c < t; c++) {
      row.push(`T${base[(r + c) % t] + 1}`);
    }
    square.push(row);
  }
  // Randomize rows and columns to randomize square
  let rowIndices = shuffle(Array.from({ length: t }, (_, i) => i));
  let colIndices = shuffle(Array.from({ length: t }, (_, i) => i));
  
  let randomizedSquare = [];
  for (let r = 0; r < t; r++) {
    let row = [];
    for (let c = 0; c < t; c++) {
      row.push(square[rowIndices[r]][colIndices[c]]);
    }
    randomizedSquare.push(row);
  }
  return randomizedSquare;
};

/**
 * The randomized plan of a field experiment. The same design settings and seed always give the same plan.
 */
export const buildLayout = ({ designType, replications, treatments, factorB, factorC, seed }) => {
  // Every shuffle in one layout draws, in order, from a single generator started from the seed
  const random = seededRandom(seed);
  const shuffle = (array) => shuffleWith(random, array);
  if (designType === 'crd_oneway') {
    const total = treatments * replications;
    const list = [];
    for (let t = 1; t <= treatments; t++) {
      for (let r = 1; r <= replications; r++) {
        list.push(`T${t} (R${r})`);
      }
    }
    const shuffled = shuffle(list);
    // Arrange in grid
    const cols = Math.ceil(Math.sqrt(total));
    const grid = [];
    for (let i = 0; i < shuffled.length; i += cols) {
      grid.push(shuffled.slice(i, i + cols));
    }
    return { type: 'crd', grid };
  } 
  else if (designType === 'crd_twoway') {
    const total = treatments * factorB * replications;
    const list = [];
    for (let a = 1; a <= treatments; a++) {
      for (let b = 1; b <= factorB; b++) {
        for (let r = 1; r <= replications; r++) {
          list.push(`A${a}B${b} (R${r})`);
        }
      }
    }
    const shuffled = shuffle(list);
    const cols = Math.ceil(Math.sqrt(total));
    const grid = [];
    for (let i = 0; i < shuffled.length; i += cols) {
      grid.push(shuffled.slice(i, i + cols));
    }
    return { type: 'crd', grid };
  } 
  else if (designType === 'rbd_oneway') {
    // blocks horizontally, plots stacked vertically
    const blocksList = [];
    for (let r = 1; r <= replications; r++) {
      const treats = Array.from({ length: treatments }, (_, idx) => `T${idx + 1}`);
      const shuffled = shuffle(treats);
      blocksList.push({ blockNum: r, plots: shuffled });
    }
    return { type: 'rbd', blocks: blocksList };
  } 
  else if (designType === 'rbd_twoway') {
    const blocksList = [];
    for (let r = 1; r <= replications; r++) {
      const treats = [];
      for (let a = 1; a <= treatments; a++) {
        for (let b = 1; b <= factorB; b++) {
          treats.push(`A${a}B${b}`);
        }
      }
      const shuffled = shuffle(treats);
      blocksList.push({ blockNum: r, plots: shuffled });
    }
    return { type: 'rbd', blocks: blocksList };
  } 
  else if (designType === 'lsd') {
    const square = latinSquare(treatments, shuffle);
    return { type: 'lsd', square };
  } 
  else if (designType === 'splitplot') {
    const blocksList = [];
    for (let r = 1; r <= replications; r++) {
      const mainTreats = Array.from({ length: treatments }, (_, idx) => `A${idx + 1}`);
      const shuffledMain = shuffle(mainTreats);
      
      const mainPlots = shuffledMain.map(mainName => {
        const subTreats = Array.from({ length: factorB }, (_, idx) => `B${idx + 1}`);
        const shuffledSub = shuffle(subTreats);
        return { mainName, subplots: shuffledSub };
      });
      blocksList.push({ blockNum: r, mainPlots });
    }
    return { type: 'splitplot', blocks: blocksList };
  } 
  else if (designType === 'subsubplot') {
    const blocksList = [];
    for (let r = 1; r <= replications; r++) {
      const mainTreats = Array.from({ length: treatments }, (_, idx) => `A${idx + 1}`);
      const shuffledMain = shuffle(mainTreats);
      
      const mainPlots = shuffledMain.map(mainName => {
        const subTreats = Array.from({ length: factorB }, (_, idx) => `B${idx + 1}`);
        const shuffledSub = shuffle(subTreats);
        
        const subplots = shuffledSub.map(subName => {
          const subSubTreats = Array.from({ length: factorC }, (_, idx) => `C${idx + 1}`);
          const shuffledSubSub = shuffle(subSubTreats);
          return { subName, subSubplots: shuffledSubSub };
        });
        
        return { mainName, subplots };
      });
      blocksList.push({ blockNum: r, mainPlots });
    }
    return { type: 'subsubplot', blocks: blocksList };
  }
  return null;
};
