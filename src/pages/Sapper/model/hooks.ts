import { useAuth } from '@context';
import { useState, useEffect } from "react";

import { cellInterface } from "@shared/types";
import { fetcherCells } from '@shared/api';
import { coeffsMap, MAX_BET } from '@shared/constants';

import toast from 'react-hot-toast';

export const useHelperSapper = () => {
    const [cells, setCells] = useState<cellInterface[]>([]);
    const [bet, setBet] = useState<number>(0);
    const [win, setWin] = useState<number>(0);
    const [step, setStep] = useState<number>(-1);
    const [mines, setMines] = useState<number[]>([]);
    const [isPlay, setIsPlay] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string>("");
    const { balance, headers, isAuth, editBalance } = useAuth();
    const [explodedCoins, setExplodedCoins] = useState<number[]>([]);
    const [explodedMines, setExplodedMines] = useState<number[]>([]);
    const [betError, setBetError] = useState<string>("");
    const [mineCount, setMineCount] = useState<number>(3);
    const mineOptions: number[] = [3, 5, 7, 13, 19, 24]
    const coeffs: number[] = coeffsMap[mineCount] || [];
    const STORAGE_KEY: string = "sapper-game-state";


    useEffect(() => {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            try {
                const s = JSON.parse(saved);
                setIsPlay(s.isPlay);
                setMineCount(s.mineCount);
                setBet(s.bet);
                setMines(s.mines);
                setExplodedCoins(s.explodedCoins);
                setStep(s.step);
                setWin(s.win);
            } catch {
                localStorage.removeItem(STORAGE_KEY);
            }
        }
        let timer: ReturnType<typeof setTimeout>;
        setLoading(true);
        fetcherCells(headers)
            .then(res => {
                if (res.length === 25) {
                    setCells(res);
                } else {
                    throw new Error("Couldnt initialize sapper grid");
                }
            })
            .catch(err => {
                if (err.response) {
                    if (err.response?.status !== 401) {
                        setError(err.response.status + " " + err.response.data.error);
                    }
                } else {
                    setError(err.message);
                }
            })
            .finally(() => {
                timer = setTimeout(() => setLoading(false), 500);
            });
        return () => clearTimeout(timer);
    }, []);

    const typeBet = (e: React.ChangeEvent<HTMLInputElement>): void => {
        const value = e.target.value.replace(/\D/g, "");
        const numericBet = Number(value);
        if (isNaN(numericBet)) return;
        if (numericBet > MAX_BET) return setBet(MAX_BET);
        setBet(numericBet);
    };

    const generateMines = (): number[] => {
        const mines: Set<number> = new Set();
        while (mines.size < mineCount) {
            const randomNum = Math.floor(Math.random() * 25) + 1;
            mines.add(randomNum);
        }
        return Array.from(mines);
    };

    const startGame = async (): Promise<void> => {
        if (!isPlay) {
            if (!bet) return setBetError("Please enter a stake");
            const numericBet = Number(bet);
            if (isNaN(numericBet)) return setBetError("Incorrect bet");
            if (numericBet < 1) return setBetError(`Minimum value is 1`);
            if (numericBet > MAX_BET) return setBetError("Maximum value is 5M");
            if (numericBet > balance) return void toast.error("Out of balance");
            // Начало игры 
            await editBalance(Math.round((balance - numericBet) * 100) / 100);
            setWin(0);
            setStep(0);
            const newMines = generateMines();
            setMines(newMines);
            setIsPlay(true);
            setExplodedCoins([]);
            setExplodedMines([]);
            setBetError("");
            localStorage.setItem(STORAGE_KEY, JSON.stringify({
                isPlay: true,
                mineCount,
                bet,
                mines: newMines,
                explodedCoins: [],
                step: 0,
                win: 0
            }));
        } else {
            if (step === -1) return void toast.error("Игра еще не начата");
            if (step === 0) return void toast.error("Сделайте хотя бы 1 ход"); // если игра начата но не сделан первый ход
            // Предварительно забрать выигрыш 
            await editBalance(Math.round((balance + win) * 100) / 100);
            localStorage.removeItem(STORAGE_KEY);
            localStorage.removeItem(STORAGE_KEY);
            setIsPlay(false);
            setWin(0);
            setStep(-1);
            setExplodedCoins([]);
            setExplodedMines([]);
        }
    };

    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const handleClick = async (cellId: number): Promise<void> => {
        if (!isPlay) return;
        if (explodedCoins.includes(cellId)) return;
        await delay(65);
        if (mines.includes(cellId)) {
            // Если была выбрата мина - игра заканчивается 
            setExplodedMines(mines);
            setIsPlay(false);
            setWin(0);
            setStep(-1);
            setTimeout(() => {
                setExplodedCoins([]);
                setExplodedMines([]);
            }, 850);
            localStorage.removeItem(STORAGE_KEY);  // Удаление игры полностью
        } else {
            // Если выбрана не мина 
            setExplodedCoins(prev => {
                const next = [...prev, cellId];
                const newStep = step + 1;
                const currentCoeff = coeffs[newStep - 1];

                if (currentCoeff === undefined) {
                    console.error("coeff for the actual step has not been found", newStep)
                    return prev;
                }

                const newWin = Number(bet) * currentCoeff;
                setStep(newStep);
                setWin(newWin);
                localStorage.setItem(STORAGE_KEY, JSON.stringify({
                    isPlay: true,
                    mineCount,
                    bet,
                    mines,
                    explodedCoins: next,
                    step: newStep,
                    win: newWin
                }));  // Обновление состояния

                // Если игрок прошел игру 
                if (next.length === cells.length - mines.length) {
                    finishGame(newWin);
                }
                return next;
            });
        }
    };

    const finishGame = async (payout: number): Promise<void> => {
        const newBalance = Math.round((balance + payout) * 100) / 100;
        await editBalance(newBalance);
        setIsPlay(false);
        setWin(0);
        setStep(-1);
        setTimeout(() => {
            setExplodedCoins([]);
            setExplodedMines([]);
        }, 850);
        localStorage.removeItem(STORAGE_KEY);
    };

    const autoClick = (): void => {
        let id;
        do {
            id = Math.floor(Math.random() * cells.length) + 1;
        } while (explodedCoins.includes(id) || explodedMines.includes(id));
        handleClick(id)
    };

    return { cells, bet, win, step, isPlay, isAuth, loading, error, balance, explodedCoins, explodedMines, mineOptions, betError, mineCount, coeffs, startGame, handleClick, autoClick, setBet, setMineCount, typeBet }
};