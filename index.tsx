/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
// Import React and ReactDOM for rendering
import React from 'react';
import ReactDOM from 'react-dom/client';

// FIX: Declare XLSX to inform TypeScript that it will be available globally, likely from a script tag.
declare var XLSX: any;

// Define a type for a skill with its score
interface Skill {
    name: string;
    score: number;
}

// Define a more specific type for a player object
interface Player {
    id: any;
    name: string;
    empId: string;
    email: string;
    location: string;
    gender: string;
    subSpace: string;
    options: {
        social: Skill[];
        indoor: Skill[];
        outdoor: Skill[];
        cultural: Skill[];
    };
    soldPrice?: number; // Optional as it's not present for unsold/upcoming players
    ['Assigned Squad']?: string;
    ['Sold Price']?: number;
    bidHistory?: { squadId: number; bidAmount: number }[];
    boughtFrom?: string;
}

// FIX: Added Squad interface for type safety.
interface Squad {
    id: number;
    name: string;
    budget: number;
    players: Player[];
}

interface TradeOffer {
    id: string;
    requestingSquadId: number;
    owningSquadId: number;
    playerId: any;
    playerName: string;
    playerAvatarName: string;
    status: 'pending' | 'countered' | 'accepted' | 'rejected' | 'withdrawn';
    history: {
        type: 'offer' | 'counter';
        squadId: number;
        price: number;
        timestamp: number;
    }[];
}

const Baap = () => {
    // FIX: Destructuring from React now works as React is imported.
    const { useState, useEffect, useCallback, useMemo, useRef } = React;
    const audioCtxRef = useRef<AudioContext | null>(null);

    const LOCATION_CONFIGS = {
        'Pune': {
            SQUAD_COUNT: 5,
            INITIAL_BUDGET: 10000000,
            MIN_SQUAD_SIZE: 40,
            MIN_FEMALE_PLAYERS: 6,
            SUB_SPACE_REQUIREMENTS: { 'Analytics': 8, 'Tech': 8, 'Marketing': 8 }
        },
        'New Delhi / Noida': {
            SQUAD_COUNT: 5,
            INITIAL_BUDGET: 6000000,
            MIN_SQUAD_SIZE: 25,
            MIN_FEMALE_PLAYERS: 5,
            SUB_SPACE_REQUIREMENTS: { 'Analytics': 5, 'Tech': 5, 'Marketing': 5 }
        },
        'Bengaluru': {
            SQUAD_COUNT: 3,
            INITIAL_BUDGET: 2000000,
            MIN_SQUAD_SIZE: 8,
            MIN_FEMALE_PLAYERS: 1,
            SUB_SPACE_REQUIREMENTS: { 'Analytics': 1, 'Tech': 1, 'Marketing': 1 }
        }
    };

    const subSpaceDisplayNames = {
        'Analytics': 'Analytics',
        'Tech': 'Technology',
        'Marketing': 'Marketing'
    };
    // FIX: Define a typed array of keys for sub-spaces to ensure type safety during iteration, preventing errors where keys could be inferred as `any` or `symbol`.
    const subSpaceKeys = Object.keys(subSpaceDisplayNames) as Array<keyof typeof subSpaceDisplayNames>;
    
    // State management
    const [selectedLocation, setSelectedLocation] = useState('Pune');
    const [allPlayers, setAllPlayers] = useState<Player[]>([]); // Master list of all players from the file
    const [players, setPlayers] = useState<Player[]>([]); // Pool of players yet to be auctioned
    // FIX: Typed the squads state with the new Squad interface. This resolves errors with arithmetic operations on squad.budget.
    const [squads, setSquads] = useState<Squad[]>([]);
    const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
    const [currentBid, setCurrentBid] = useState(0);
    const [highestBidder, setHighestBidder] = useState(null);
    const [auctionStarted, setAuctionStarted] = useState(false);
    const [unsoldPlayers, setUnsoldPlayers] = useState<Player[]>([]);
    const [fileName, setFileName] = useState('');
    const [error, setError] = useState('');
    const [auctionOver, setAuctionOver] = useState(false);
    const [assigneeSquadId, setAssigneeSquadId] = useState(null);
    const [history, setHistory] = useState([]);
// FIX: Explicitly type the rosterModalSquad state to prevent type inference issues.
    const [rosterModalSquad, setRosterModalSquad] = useState<Squad | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResult, setSearchResult] = useState(null);
    const [modalConfig, setModalConfig] = useState(null);
    const [preAuctionWarnings, setPreAuctionWarnings] = useState<number[]>([]);
    const [currentBidHistory, setCurrentBidHistory] = useState<{ squadId: number, bidAmount: number }[]>([]);
    const [viewingBidHistoryForPlayer, setViewingBidHistoryForPlayer] = useState<Player | null>(null);
    const [isUnsoldRosterModalOpen, setIsUnsoldRosterModalOpen] = useState(false);
    const [isRemainingRosterModalOpen, setIsRemainingRosterModalOpen] = useState(false);
    const [isBulkAssignModalOpen, setIsBulkAssignModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [lastExportTrigger, setLastExportTrigger] = useState(null);
    const [animationState, setAnimationState] = useState({ type: null, price: 0, squadName: '' });
    const [selectedUnsoldPlayers, setSelectedUnsoldPlayers] = useState<any[]>([]);
    const [squadsToCompare, setSquadsToCompare] = useState<number[]>([]);
    const [isCompareModalOpen, setIsCompareModalOpen] = useState(false);
    const [isUnsoldCardCollapsed, setIsUnsoldCardCollapsed] = useState(false);
    const [activeMainTab, setActiveMainTab] = useState('dashboard');
    const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info'; exiting: boolean }[]>([]);
    
    // Timer and Settings State
    const initialLocationConfig = LOCATION_CONFIGS[selectedLocation];
    const [settings, setSettings] = useState({
        initialDuration: 20,
        bidDuration: 10,
        negotiationDuration: 30,
        autoExportEnabled: true,
        minSquadSize: initialLocationConfig.MIN_SQUAD_SIZE,
        minFemalePlayers: initialLocationConfig.MIN_FEMALE_PLAYERS,
        subSpaceRequirements: initialLocationConfig.SUB_SPACE_REQUIREMENTS
    });
    const [timerValue, setTimerValue] = useState(settings.initialDuration);
    const [timerDuration, setTimerDuration] = useState(settings.initialDuration);
    const [isTimerRunning, setIsTimerRunning] = useState(false);
    const [timerKey, setTimerKey] = useState(0); // Used to reset timer animation
    const [isPausedForModal, setIsPausedForModal] = useState(false);
    
    // --- NEW Trading State ---
    const [tradingPool, setTradingPool] = useState<{ playerId: any, sellingSquadId: number, basePrice: number }[]>([]);
    const [tradeAuctionState, setTradeAuctionState] = useState<{ status: 'nominating' | 'active' | 'finished', currentPlayerIndex: number }>({ status: 'nominating', currentPlayerIndex: -1 });
    const [nominationConfig, setNominationConfig] = useState<{ player: Player, sellingSquadId: number } | null>(null);
    const [currentSellingSquadId, setCurrentSellingSquadId] = useState<number | null>(null);
    const [tradeOffers, setTradeOffers] = useState<TradeOffer[]>([]);
    const [offerConfig, setOfferConfig] = useState<{ player: Player, owningSquad: Squad } | null>(null);
    const [tradeNegotiationState, setTradeNegotiationState] = useState<{ status: 'collecting' | 'negotiating' | 'finished', currentPlayerIndex: number }>({ status: 'collecting', currentPlayerIndex: -1 });
    const [counterOfferConfig, setCounterOfferConfig] = useState<{ offer: TradeOffer } | null>(null);

    // --- NEW Negotiation Timer State ---
    const [negotiationTimerValue, setNegotiationTimerValue] = useState(30);
    const [isNegotiationTimerRunning, setIsNegotiationTimerRunning] = useState(false);
    const [negotiationTimerKey, setNegotiationTimerKey] = useState(0);

    // --- State lifted from TradingBlock ---
    const [selectedOfferId, setSelectedOfferId] = useState<string | null>(null);
    const [negotiationAnimationState, setNegotiationAnimationState] = useState<{ type: 'accepted' | 'rejected' | 'countered', offer: TradeOffer, price?: number } | null>(null);

    // FIX: Moved getPlayerFromPool to the App scope to be accessible by child components like CurrentPlayerCard.
    const getPlayerFromPool = useCallback((playerId) => {
        for (const squad of squads) {
            // FIX: Trim whitespace and compare as strings to handle potential type inconsistencies (e.g., number vs string ID).
            const player = squad.players.find(p => String(p.id).trim() === String(playerId).trim());
            if (player) return player;
        }
        return null;
    }, [squads]);


    // Derive constants from selected location
    const { SQUAD_COUNT, INITIAL_BUDGET } = LOCATION_CONFIGS[selectedLocation];
    const { minSquadSize, minFemalePlayers, subSpaceRequirements } = settings;
    const BASE_PRICE = 100000;

    // --- Logic lifted from TradingBlock ---
    const playersWithPendingOffers = useMemo(() => {
        const playerOffers = tradeOffers.reduce((acc, offer) => {
            if (offer.status === 'pending' || offer.status === 'countered') {
                if (!acc[offer.playerId]) {
                    acc[offer.playerId] = [];
                }
                acc[offer.playerId].push(offer);
            }
            return acc;
        }, {} as { [key: string]: TradeOffer[] });

        return Object.keys(playerOffers).map(playerId => {
            const player = getPlayerFromPool(playerId);
            const owningSquad = squads.find(s => s.id === playerOffers[playerId][0].owningSquadId);
            return {
                playerId,
                player,
                owningSquad,
                offerCount: playerOffers[playerId].length
            };
        }).filter(item => item.player && item.owningSquad);
    }, [tradeOffers, getPlayerFromPool, squads]);

    const handleBasePriceChange = (newPriceStr: string) => {
        if (highestBidder !== null) return;
    
        if (newPriceStr === '') {
            setCurrentBid(0);
            return;
        }
    
        const newPrice = parseInt(newPriceStr, 10);
        if (!isNaN(newPrice) && newPrice >= 0) {
            setCurrentBid(newPrice);
        }
    };

    const handlePriceStepChange = (direction: 'increase' | 'decrease') => {
        if (highestBidder !== null) return;
        const step = 10000;
        setCurrentBid(prev => {
            const newPrice = direction === 'increase' ? prev + step : prev - step;
            return Math.max(10000, newPrice); // Minimum price is 10k
        });
    };

    const calculateNextBid = (bid) => {
        if (bid < 200000) return bid + 10000;
        if (bid < 300000) return bid + 20000;
        if (bid < 500000) return bid + 40000;
        if (bid < 900000) return bid + 80000;
        return bid + 160000;
    };

    const nextBidAmount = useMemo(() => {
        if (highestBidder === null) {
            // If no bids yet, the first bid amount is whatever the current base price is set to.
            return currentBid;
        }
        return calculateNextBid(currentBid);
    }, [highestBidder, currentBid]);

    // Load state from local storage on initial render
    useEffect(() => {
        try {
            const savedStateJSON = localStorage.getItem('auctionState');
            if (savedStateJSON) {
                const savedState = JSON.parse(savedStateJSON);
                const location = savedState.selectedLocation || 'Pune';
                const config = LOCATION_CONFIGS[location];

                setSelectedLocation(location);
                setAllPlayers(savedState.allPlayers || []);
                setPlayers(savedState.players);
                // Ensure loaded squads match location config if budgets/counts differ
                const initialSquads = Array.from({ length: config.SQUAD_COUNT }, (_, i) => ({
                    id: i + 1,
                    name: `Squad ${i + 1}`,
                    budget: config.INITIAL_BUDGET,
                    players: [],
                }));
                 setSquads(savedState.squads || initialSquads);
                setCurrentPlayer(savedState.currentPlayer);
                setCurrentBid(savedState.currentBid || BASE_PRICE);
                setHighestBidder(savedState.highestBidder);
                setAuctionStarted(savedState.auctionStarted);
                setUnsoldPlayers(savedState.unsoldPlayers);
                setFileName(savedState.fileName);
                setAuctionOver(savedState.auctionOver);
                setHistory(savedState.history || []);
                setTradingPool(savedState.tradingPool || []);
                setTradeOffers(savedState.tradeOffers || []);
                setTradeNegotiationState(savedState.tradeNegotiationState || { status: 'collecting', currentPlayerIndex: -1 });
                setSettings({
                    initialDuration: 20,
                    bidDuration: 10,
                    negotiationDuration: 30,
                    autoExportEnabled: true,
                    minSquadSize: config.MIN_SQUAD_SIZE,
                    minFemalePlayers: config.MIN_FEMALE_PLAYERS,
                    subSpaceRequirements: config.SUB_SPACE_REQUIREMENTS,
                    ...savedState.settings
                });
            } else {
                 const initialSquads = Array.from({ length: SQUAD_COUNT }, (_, i) => ({
                    id: i + 1,
                    name: `Squad ${i + 1}`,
                    budget: INITIAL_BUDGET,
                    players: [],
                }));
                setSquads(initialSquads);
            }
        } catch (e) {
            console.error("Failed to load state from local storage", e);
             const initialSquads = Array.from({ length: SQUAD_COUNT }, (_, i) => ({
                id: i + 1,
                name: `Squad ${i + 1}`,
                budget: INITIAL_BUDGET,
                players: [],
            }));
            setSquads(initialSquads);
        }
    }, []);
    
    // Reset squads and settings if location changes before auction starts
    useEffect(() => {
        if (!auctionStarted && allPlayers.length === 0) {
            const currentConfig = LOCATION_CONFIGS[selectedLocation];
            const initialSquads = Array.from({ length: currentConfig.SQUAD_COUNT }, (_, i) => ({
                id: i + 1,
                name: `Squad ${i + 1}`,
                budget: currentConfig.INITIAL_BUDGET,
                players: [],
            }));
            setSquads(initialSquads);
            setSettings(prev => ({
                ...prev,
                minSquadSize: currentConfig.MIN_SQUAD_SIZE,
                minFemalePlayers: currentConfig.MIN_FEMALE_PLAYERS,
                subSpaceRequirements: currentConfig.SUB_SPACE_REQUIREMENTS
            }));
        }
    }, [selectedLocation, auctionStarted, allPlayers.length]);

    // Pre-auction validation checks
    useEffect(() => {
        if (!auctionStarted && allPlayers.length === 0) {
            const warnings = [];
            const minBudgetRequired = minSquadSize * BASE_PRICE;
            squads.forEach(squad => {
                if (squad.budget < minBudgetRequired) {
                    warnings.push(squad.id);
                }
            });
            setPreAuctionWarnings(warnings);
        } else {
            setPreAuctionWarnings([]); // Clear warnings once file is loaded or auction starts
        }
    }, [squads, auctionStarted, allPlayers.length, minSquadSize, BASE_PRICE]);


    // Save state to local storage whenever it changes
    useEffect(() => {
        if (auctionStarted || allPlayers.length > 0) {
            const stateToSave = {
                selectedLocation, allPlayers, players, squads, currentPlayer, currentBid, highestBidder,
                auctionStarted, unsoldPlayers, fileName, auctionOver, history, settings, tradingPool,
                tradeOffers, tradeNegotiationState
            };
            localStorage.setItem('auctionState', JSON.stringify(stateToSave));
        }
    }, [selectedLocation, allPlayers, players, squads, currentPlayer, currentBid, highestBidder, auctionStarted, unsoldPlayers, fileName, auctionOver, history, settings, tradingPool, tradeOffers, tradeNegotiationState]);

    // Timer countdown logic
    useEffect(() => {
        if (!isTimerRunning || !auctionStarted) {
            return;
        }

        if (timerValue <= 0) {
            // Use a timeout to prevent potential race conditions with state updates
            setTimeout(() => {
                if (highestBidder) {
                    sellPlayer();
                } else {
                    moveToNextPlayer();
                }
            }, 100);
            return;
        }

        if (timerValue > 0 && timerValue <= 5) {
            playSound('tick');
        }

        const timerId = setTimeout(() => {
            setTimerValue(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timerId);

    }, [timerValue, isTimerRunning, auctionStarted, currentPlayer, highestBidder]);

    // Auto-export logic
    useEffect(() => {
        // This effect will only run when lastExportTrigger is updated,
        // which happens after a player is sold or passed on.
        // It will not run on initial load as lastExportTrigger is null.
        if (lastExportTrigger && settings.autoExportEnabled) {
            exportAuctionState();
        }
    }, [lastExportTrigger, settings.autoExportEnabled]);

    // --- NEW Negotiation Timer Logic ---
    useEffect(() => {
        if (!isNegotiationTimerRunning || tradeNegotiationState.status !== 'negotiating') {
            return;
        }

        if (negotiationTimerValue <= 0) {
            setTimeout(() => {
                if (selectedOfferId) {
                    addToast('Time is up! The offer has been automatically rejected.', 'error');
                    const offer = tradeOffers.find(o => o.id === selectedOfferId);
                    if (offer) {
                        handleOfferResponse(selectedOfferId, 'reject');
                    }
                }
            }, 100);
            return;
        }

        if (negotiationTimerValue > 0 && negotiationTimerValue <= 5) {
            playSound('tick');
        }

        const timerId = setTimeout(() => {
            setNegotiationTimerValue(prev => prev - 1);
        }, 1000);

        return () => clearTimeout(timerId);

    }, [negotiationTimerValue, isNegotiationTimerRunning, tradeNegotiationState.status, selectedOfferId]);

    // Effect to start/stop the negotiation timer
    useEffect(() => {
        if (tradeNegotiationState.status === 'negotiating' && playersWithPendingOffers.length > 0) {
            setIsNegotiationTimerRunning(true);
            setNegotiationTimerValue(settings.negotiationDuration);
            setNegotiationTimerKey(prev => prev + 1);
        } else {
            setIsNegotiationTimerRunning(false);
        }
    }, [tradeNegotiationState.status, playersWithPendingOffers.length, settings.negotiationDuration]);


    const pauseTimerForModal = () => {
        if (isTimerRunning || isNegotiationTimerRunning) {
            setIsPausedForModal(true);
        }
        if (isTimerRunning) setIsTimerRunning(false);
        if (isNegotiationTimerRunning) setIsNegotiationTimerRunning(false);
    };

    const resumeTimerAfterModal = () => {
        if (isPausedForModal) {
            if (tradeNegotiationState.status === 'negotiating' && playersWithPendingOffers.length > 0) {
                setIsNegotiationTimerRunning(true);
            } else if ((auctionStarted && currentPlayer) || tradeAuctionState.status === 'active') {
                setIsTimerRunning(true);
            }
            setIsPausedForModal(false);
        }
    };


    const parseSkill = (skillString: string | undefined): Skill | null => {
        if (!skillString || typeof skillString !== 'string') return null;
        const match = skillString.match(/(.+?)\s*\((\d+)\)/);
        if (match && match[1] && match[2]) {
            return { name: match[1].trim(), score: parseInt(match[2], 10) };
        }
        // If no score is found, assume a default score (e.g., 5)
        return { name: skillString.trim(), score: 5 };
    };
    
    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) return;
        setFileName(file.name);
        setError('');

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (e.target.result instanceof ArrayBuffer) {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const sheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[sheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet);
                    
                    const formattedPlayers: Player[] = json.map((player, index) => ({
                        id: player.empId || index,
                        name: player.Name,
                        empId: player.empId,
                        email: player.email,
                        location: player['Office Location'],
                        gender: player.Gender,
                        subSpace: player['Sub-Space'],
                        options: {
                            social: [player.Social_Option1, player.Social_Option2, player.Social_Option3].map(parseSkill).filter(Boolean) as Skill[],
                            indoor: [player.Indoor_Option1, player.Indoor_Option2].map(parseSkill).filter(Boolean) as Skill[],
                            outdoor: [player.Outdoor_Option1, player.Outdoor_Option2, player.Outdoor_Option3].map(parseSkill).filter(Boolean) as Skill[],
                            cultural: [player.Cultural_Option1, player.Cultural_Option2].map(parseSkill).filter(Boolean) as Skill[],
                        }
                    })).sort((a, b) => a.name.localeCompare(b.name));
                    
                    setAllPlayers(formattedPlayers);
                    setPlayers(formattedPlayers);
                }
            } catch (err) {
                console.error("Error parsing file:", err);
                setError("Failed to parse the Excel file. Please ensure it's a valid format.");
            }
        };
        reader.readAsArrayBuffer(file);
    };
    
    const resetAuction = () => {
        localStorage.removeItem('auctionState');

        setAllPlayers([]);
        setPlayers([]);
        setFileName('');
        
        const currentConfig = LOCATION_CONFIGS[selectedLocation];
        const initialSquads = Array.from({ length: currentConfig.SQUAD_COUNT }, (_, i) => ({
            id: i + 1,
            name: `Squad ${i + 1}`,
            budget: currentConfig.INITIAL_BUDGET,
            players: [],
        }));
        setSquads(initialSquads);
        setSettings({
            initialDuration: 20,
            bidDuration: 10,
            negotiationDuration: 30,
            autoExportEnabled: true,
            minSquadSize: currentConfig.MIN_SQUAD_SIZE,
            minFemalePlayers: currentConfig.MIN_FEMALE_PLAYERS,
            subSpaceRequirements: currentConfig.SUB_SPACE_REQUIREMENTS
        });

        setCurrentPlayer(null);
        setCurrentBid(0);
        setHighestBidder(null);
        setAuctionStarted(false);
        setUnsoldPlayers([]);
        setError('');
        setAuctionOver(false);
        setAssigneeSquadId(null);
        setHistory([]);
        setRosterModalSquad(null);
        setSearchQuery('');
        setSearchResult(null);
        setCurrentBidHistory([]);
        setViewingBidHistoryForPlayer(null);
        setIsUnsoldRosterModalOpen(false);
        setIsRemainingRosterModalOpen(false);
        setIsTimerRunning(false);
        setSelectedUnsoldPlayers([]);
        setTradingPool([]);
        setTradeOffers([]);
        setTradeAuctionState({ status: 'nominating', currentPlayerIndex: -1 });
        setTradeNegotiationState({ status: 'collecting', currentPlayerIndex: -1 });
        setCurrentSellingSquadId(null);
        setActiveMainTab('dashboard');
    };

    const selectNextPlayer = (playerPool: Player[]) => {
        if (playerPool.length === 0) {
            setAuctionOver(true);
            setCurrentPlayer(null);
            setIsTimerRunning(false);
            setCurrentSellingSquadId(null);
        } else {
            const randomIndex = Math.floor(Math.random() * playerPool.length);
            setCurrentPlayer(playerPool[randomIndex]);
            setCurrentBid(BASE_PRICE);
            setHighestBidder(null);
            setCurrentBidHistory([]);
            setError('');
            setAssigneeSquadId(null);
            setCurrentSellingSquadId(null);
            
            // Start timer for new player
            setTimerDuration(settings.initialDuration);
            setTimerValue(settings.initialDuration);
            setTimerKey(prev => prev + 1);
            setIsTimerRunning(true);
        }
    };

    const selectNextTradePlayer = () => {
        const nextIndex = tradeAuctionState.currentPlayerIndex + 1;
        
        if (nextIndex >= tradingPool.length) {
            // Trade auction is finished
            setTradeAuctionState({ status: 'finished', currentPlayerIndex: -1 });
            setCurrentPlayer(null);
            setCurrentSellingSquadId(null);
            setIsTimerRunning(false);
            return;
        }

        const nextTradeItem = tradingPool[nextIndex];
        const sellingSquad = squads.find(s => s.id === nextTradeItem.sellingSquadId);
        const playerForAuction = sellingSquad?.players.find(p => p.id === nextTradeItem.playerId);

        if (playerForAuction) {
            setTradeAuctionState(prev => ({ ...prev, currentPlayerIndex: nextIndex }));
            setCurrentPlayer(playerForAuction);
            setCurrentSellingSquadId(nextTradeItem.sellingSquadId);
            setCurrentBid(nextTradeItem.basePrice);
            setHighestBidder(null);
            setCurrentBidHistory([]);
            setError('');
            setAssigneeSquadId(null);
            
            setTimerDuration(settings.initialDuration);
            setTimerValue(settings.initialDuration);
            setTimerKey(prev => prev + 1);
            setIsTimerRunning(true);
        } else {
            // Player not found (shouldn't happen), skip to next
            setTradeAuctionState(prev => ({ ...prev, currentPlayerIndex: nextIndex }));
            selectNextTradePlayer();
        }
    };
    
    const startAuction = () => {
        if (players.length > 0) {
            setAuctionStarted(true);
            selectNextPlayer(players);
        } else {
            setError("Please upload a player list before starting the auction.");
        }
    };
    
    const formatCurrency = (amount) => {
        if (typeof amount !== 'number') return '$0K';
        if (amount >= 1000000) {
            return `$${(amount / 1000000).toFixed(2)}M`;
        }
        return `$${(amount / 1000).toFixed(0)}K`;
    };
    
    const canSquadBid = useCallback((squad, bidAmount) => {
        if (!squad) return false;
        if (squad.budget < bidAmount) return false;

        // Check if after this purchase, the squad can still afford to buy the minimum number of remaining players
        const remainingSlots = minSquadSize - (squad.players.length + 1);
        if (remainingSlots <= 0) return true; // Roster is full or will be full, no need to save for more players
        
        const remainingBudget = squad.budget - bidAmount;
        return remainingBudget >= remainingSlots * BASE_PRICE;
    }, [squads, minSquadSize, BASE_PRICE]);

    const getBidDisabledReason = useCallback((squad, nextBid) => {
        if (!currentPlayer) return "No player is being auctioned.";
        if (nextBid < 10000) return "Bid must be at least $10,000.";
        if (squad.id === highestBidder) return "You are already the highest bidder.";

        if (tradeAuctionState.status === 'active' && squad.id === currentSellingSquadId) {
            return "You cannot bid on your own player.";
        }

        if (squad.budget < nextBid) {
            return `Insufficient budget. Next bid is ${formatCurrency(nextBid)}.`;
        }
        
        const remainingSlots = minSquadSize - (squad.players.length + 1);
        if (remainingSlots > 0) {
            const remainingBudget = squad.budget - nextBid;
            if (remainingBudget < remainingSlots * BASE_PRICE) {
                return "This bid would prevent meeting minimum roster size requirements.";
            }
        }
        
        return null; // Bid is allowed
    }, [currentPlayer, highestBidder, minSquadSize, BASE_PRICE, tradeAuctionState.status, currentSellingSquadId]);
    
    const saveStateForUndo = () => {
        const snapshot = {
            squads: JSON.parse(JSON.stringify(squads)), // Deep copy
            players: [...players],
            unsoldPlayers: [...unsoldPlayers],
            currentPlayer: currentPlayer,
            auctionOver: auctionOver,
            currentBid: currentBid,
            highestBidder: highestBidder,
            currentBidHistory: [...currentBidHistory],
            tradingPool: JSON.parse(JSON.stringify(tradingPool)),
            tradeAuctionState: { ...tradeAuctionState },
            currentSellingSquadId: currentSellingSquadId,
            tradeOffers: JSON.parse(JSON.stringify(tradeOffers)),
            tradeNegotiationState: { ...tradeNegotiationState },
        };
        setHistory(prev => [...prev, snapshot]);
    };
    
    const handleUndo = () => {
        if (history.length === 0) return;
        const lastState = history[history.length - 1];
        setSquads(lastState.squads);
        setPlayers(lastState.players);
        setUnsoldPlayers(lastState.unsoldPlayers);
        setCurrentPlayer(lastState.currentPlayer);
        setAuctionOver(lastState.auctionOver);
        setCurrentBid(lastState.currentBid);
        setHighestBidder(lastState.highestBidder);
        setCurrentBidHistory(lastState.currentBidHistory);
        setTradingPool(lastState.tradingPool);
        setTradeAuctionState(lastState.tradeAuctionState);
        setCurrentSellingSquadId(lastState.currentSellingSquadId);
        setTradeOffers(lastState.tradeOffers);
        setTradeNegotiationState(lastState.tradeNegotiationState);
        
        setError('');
        setAssigneeSquadId(null);
        setHistory(prev => prev.slice(0, -1));
        setIsTimerRunning(false); // Stop timer on undo
        setSelectedUnsoldPlayers([]);
    };

    const handleBid = (squadId) => {
        const squad = squads.find(s => s.id === squadId);
        const nextBid = nextBidAmount;

        if (squad && canSquadBid(squad, nextBid)) {
            playSound('bid');
            saveStateForUndo();
            setCurrentBidHistory(prev => [...prev, { squadId, bidAmount: nextBid }]);
            setCurrentBid(nextBid);
            setHighestBidder(squadId);
            setError('');
            // Reset timer on new bid
            setTimerDuration(settings.bidDuration);
            setTimerValue(settings.bidDuration);
            setTimerKey(prev => prev + 1);
            setIsTimerRunning(true);
        } else {
            setError(`Squad ${squadId} cannot afford this bid or doing so would prevent them from meeting minimum roster size.`);
        }
    };
    
    const finalizePlayerAndMoveOn = (soldToSquad, price, bidHistoryForPlayer) => {
        saveStateForUndo();

        // Handle Trade Auction Sale
        if (tradeAuctionState.status === 'active') {
            const sellingSquad = squads.find(s => s.id === currentSellingSquadId);

            if (soldToSquad && sellingSquad) {
                const tradedPlayer = { ...currentPlayer, soldPrice: price, bidHistory: bidHistoryForPlayer, boughtFrom: `Trade: ${sellingSquad.name}` };
                
                const updatedSquads = squads.map(s => {
                    // Winning squad: loses budget, gains player
                    if (s.id === soldToSquad.id) {
                        return { ...s, budget: s.budget - price, players: [...s.players, tradedPlayer] };
                    }
                    // Selling squad: gains budget, loses player
                    if (s.id === sellingSquad.id) {
                        return { ...s, budget: s.budget + price, players: s.players.filter(p => p.id !== currentPlayer.id) };
                    }
                    return s;
                });
                setSquads(updatedSquads);
            }
            // If unsold in trade auction, player stays with original team. No state change needed for squads.
            selectNextTradePlayer();
            
        } else { // Handle Regular Auction Sale
            const newPlayerPool = players.filter(p => p.id !== currentPlayer.id);
            
            if (soldToSquad) {
                const soldPlayer = { ...currentPlayer, soldPrice: price, bidHistory: bidHistoryForPlayer, boughtFrom: 'Market' };
                setSquads(squads.map(s => 
                    s.id === soldToSquad.id 
                    ? { ...s, budget: s.budget - price, players: [...s.players, soldPlayer] } 
                    : s
                ));
            } else {
                setUnsoldPlayers(prev => [...prev, currentPlayer]);
            }
            
            setPlayers(newPlayerPool);
            selectNextPlayer(newPlayerPool);
        }
        
        setLastExportTrigger(Date.now());
    };

    const handleAnimationEnd = () => {
        if (animationState.type === 'sold') {
            const winningSquad = squads.find(s => s.id === highestBidder);
            finalizePlayerAndMoveOn(winningSquad, currentBid, currentBidHistory);
        } else if (animationState.type === 'unsold') {
            finalizePlayerAndMoveOn(null, 0, []);
        }
        
        setAnimationState({ type: null, price: 0, squadName: '' });
    };

    const sellPlayer = () => {
        if (!highestBidder) {
            setError("No bids were placed for this player. Click 'Next Player' to pass.");
            return;
        }
        if (!currentPlayer) return;

        playSound('sold');
        setIsTimerRunning(false);
        const winningSquad = squads.find(s => s.id === highestBidder);
        setAnimationState({
            type: 'sold',
            price: currentBid,
            squadName: winningSquad.name
        });
    };
    
    const handleAssignAtBasePrice = () => {
        if (!assigneeSquadId) {
            setError("Please select a squad to assign the player to.");
            return;
        }
        const squad = squads.find(s => s.id === assigneeSquadId);

        if (squad && canSquadBid(squad, BASE_PRICE)) {
            const historyForAssign = [{ squadId: assigneeSquadId, bidAmount: BASE_PRICE }];
            finalizePlayerAndMoveOn(squad, BASE_PRICE, historyForAssign);
        } else {
            setError(`Squad ${assigneeSquadId} cannot afford the base price or cannot meet roster requirements.`);
        }
    };
    
    const moveToNextPlayer = () => {
        if (!currentPlayer) return;
        setIsTimerRunning(false);
        setAnimationState({
            type: 'unsold',
            price: 0,
            squadName: ''
        });
    };

    const handleToggleUnsoldSelection = (playerId: any) => {
        setSelectedUnsoldPlayers(prev =>
            prev.includes(playerId)
                ? prev.filter(id => id !== playerId)
                : [...prev, playerId]
        );
    };

    const handleToggleSelectAllUnsold = () => {
        if (selectedUnsoldPlayers.length === unsoldPlayers.length) {
            setSelectedUnsoldPlayers([]);
        } else {
            setSelectedUnsoldPlayers(unsoldPlayers.map(p => p.id));
        }
    };

    const handleReAuctionSelected = () => {
        if (selectedUnsoldPlayers.length === 0) return;

        saveStateForUndo();

        const playersToReAuction = unsoldPlayers.filter(p => selectedUnsoldPlayers.includes(p.id));
        const remainingUnsold = unsoldPlayers.filter(p => !selectedUnsoldPlayers.includes(p.id));
        const newPlayerPool = [...players, ...playersToReAuction];

        setUnsoldPlayers(remainingUnsold);
        setPlayers(newPlayerPool);
        setSelectedUnsoldPlayers([]); // Clear selection

        // If the auction was over, we need to restart it.
        if (auctionOver) {
            setAuctionOver(false);
            selectNextPlayer(newPlayerPool);
        }
        // If the auction is ongoing, we do nothing else. The players are simply added
        // to the pool and will be available in subsequent rounds.
    };
    
    const handleBulkAssignConfirm = (assignments: { [playerId: string]: { squadId: number | null, price: number } }) => {
        saveStateForUndo();

        const updatedSquads = JSON.parse(JSON.stringify(squads));
        let updatedUnsoldPlayers = [...unsoldPlayers];

        Object.entries(assignments).forEach(([playerId, assignment]) => {
            const { squadId, price } = assignment;
            if (!squadId) return;

            const playerToAssign = updatedUnsoldPlayers.find(p => p.id.toString() === playerId);
            const targetSquad = updatedSquads.find(s => s.id === squadId);

            if (playerToAssign && targetSquad && targetSquad.budget >= price) {
                const soldPlayer = { ...playerToAssign, soldPrice: price, boughtFrom: 'Market' };
                targetSquad.players.push(soldPlayer);
                targetSquad.budget -= price;
                updatedUnsoldPlayers = updatedUnsoldPlayers.filter(p => p.id.toString() !== playerId);
            }
        });

        setSquads(updatedSquads);
        setUnsoldPlayers(updatedUnsoldPlayers);
        setIsBulkAssignModalOpen(false);
    };

    const getSquadStats = useCallback((squad) => {
        const femaleCount = squad.players.filter(p => p.gender === 'Female').length;
        const subSpaceCounts = {
            'Analytics': squad.players.filter(p => p.subSpace === 'Analytics').length,
            'Tech': squad.players.filter(p => p.subSpace === 'Tech' || p.subSpace === 'India DCE Technology').length,
            'Marketing': squad.players.filter(p => p.subSpace === 'Marketing Services').length,
        };
        return { femaleCount, subSpaceCounts };
    }, []);


    const handleToggleCompare = (squadId: number) => {
        setSquadsToCompare(prev => {
            if (prev.includes(squadId)) {
                return prev.filter(id => id !== squadId);
            } else {
                if (prev.length < 5) {
                    return [...prev, squadId];
                }
                setError("You can compare a maximum of 5 squads at a time.");
                setTimeout(() => setError(''), 3000);
                return prev;
            }
        });
    };

    const exportAuctionState = () => {
        const formatSkillForExport = (skill: Skill) => `${skill.name}(${skill.score})`;

        const soldPlayersData = squads.flatMap(squad =>
            squad.players.map(player => ({
                ...player,
                'Assigned Squad': squad.name,
                'Sold Price': player.soldPrice
            }))
        );
        const unsoldPlayersData = unsoldPlayers.map(player => ({
            ...player,
            'Assigned Squad': 'Unsold',
            'Sold Price': 0
        }));
        
        // Add current player to the "not auctioned" list for export purposes, unless the auction is over.
        const remainingAndCurrentPlayers = currentPlayer ? [...players.filter(p => p.id !== currentPlayer.id), currentPlayer] : players;
        const remainingPlayersData = remainingAndCurrentPlayers.map(player => ({
            ...player,
            'Assigned Squad': 'Not Auctioned',
            'Sold Price': 0,
        }));


        const allPlayersForExport = [...soldPlayersData, ...unsoldPlayersData, ...remainingPlayersData].sort((a,b) => a.name.localeCompare(b.name));

        const formattedForSheet = allPlayersForExport.map(p => ({
            'Name': p.name,
            'empId': p.empId,
            'email': p.email,
            'Office Location': p.location,
            'Gender': p.gender,
            'Sub-Space': p.subSpace,
            'Social_Option1': p.options.social[0] ? formatSkillForExport(p.options.social[0]) : '',
            'Social_Option2': p.options.social[1] ? formatSkillForExport(p.options.social[1]) : '',
            'Social_Option3': p.options.social[2] ? formatSkillForExport(p.options.social[2]) : '',
            'Indoor_Option1': p.options.indoor[0] ? formatSkillForExport(p.options.indoor[0]) : '',
            'Indoor_Option2': p.options.indoor[1] ? formatSkillForExport(p.options.indoor[1]) : '',
            'Outdoor_Option1': p.options.outdoor[0] ? formatSkillForExport(p.options.outdoor[0]) : '',
            'Outdoor_Option2': p.options.outdoor[1] ? formatSkillForExport(p.options.outdoor[1]) : '',
            'Outdoor_Option3': p.options.outdoor[2] ? formatSkillForExport(p.options.outdoor[2]) : '',
            'Cultural_Option1': p.options.cultural[0] ? formatSkillForExport(p.options.cultural[0]) : '',
            'Cultural_Option2': p.options.cultural[1] ? formatSkillForExport(p.options.cultural[1]) : '',
            'Assigned Squad': p['Assigned Squad'],
            'Sold Price': p['Sold Price'],
            'Bought From': p.boughtFrom || ''
        }));

        const worksheet = XLSX.utils.json_to_sheet(formattedForSheet);
        const workbook = XLSX.utils.book_new();

        // Add metadata for state restoration
        const metadata = [
            { key: 'selectedLocation', value: selectedLocation },
            { key: 'SQUAD_COUNT', value: SQUAD_COUNT },
            { key: 'INITIAL_BUDGET', value: INITIAL_BUDGET },
            { key: 'minSquadSize', value: settings.minSquadSize },
            { key: 'minFemalePlayers', value: settings.minFemalePlayers },
            { key: 'subSpaceRequirements', value: JSON.stringify(settings.subSpaceRequirements) },
            { key: 'currentPlayerId', value: currentPlayer ? currentPlayer.id : null },
            { key: 'currentBid', value: currentBid },
            { key: 'highestBidder', value: highestBidder },
            { key: 'currentBidHistory', value: JSON.stringify(currentBidHistory) },
            { key: 'tradeOffers', value: JSON.stringify(tradeOffers) },
            { key: 'tradeNegotiationState', value: JSON.stringify(tradeNegotiationState) },
        ];
        const metadataWorksheet = XLSX.utils.json_to_sheet(metadata);
        XLSX.utils.book_append_sheet(workbook, metadataWorksheet, "Metadata");
        XLSX.utils.book_append_sheet(workbook, worksheet, "Auction Results");
        
        // --- NEW: Add Squad Summary Sheet ---
        const squadSummaryData = squads.map(squad => {
            const totalSpend = squad.players.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
            return {
                'Squad Name': squad.name,
                'Initial Budget': INITIAL_BUDGET,
                'Total Spend': totalSpend,
                'Final Remaining Budget': squad.budget,
                'Total Players': squad.players.length,
            };
        });

        const squadSummaryWorksheet = XLSX.utils.json_to_sheet(squadSummaryData);
        XLSX.utils.book_append_sheet(workbook, squadSummaryWorksheet, "Squad Summary");

        XLSX.writeFile(workbook, "Auction_Results.xlsx");
    };
    
    const handleLoadFromExport = (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                if (e.target.result instanceof ArrayBuffer) {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });

                    // 1. Read Metadata
                    const metadataSheet = workbook.Sheets['Metadata'];
                    if (!metadataSheet) throw new Error("Invalid export file: Missing 'Metadata' sheet.");
                    const metadata = XLSX.utils.sheet_to_json(metadataSheet);
                    const loadedLocation = metadata.find(r => r.key === 'selectedLocation')?.value;
                    if (!loadedLocation || !LOCATION_CONFIGS[loadedLocation]) {
                        throw new Error("Invalid export file: Location metadata is missing or invalid.");
                    }
                    setSelectedLocation(loadedLocation);
                    const config = LOCATION_CONFIGS[loadedLocation];
                    
                    const loadedMinSquadSize = metadata.find(r => r.key === 'minSquadSize')?.value;
                    const loadedMinFemale = metadata.find(r => r.key === 'minFemalePlayers')?.value;
                    const loadedSubSpaceReqsJSON = metadata.find(r => r.key === 'subSpaceRequirements')?.value;
                    
                    const newSettings = { ...settings };
                    newSettings.minSquadSize = loadedMinSquadSize !== undefined ? parseInt(loadedMinSquadSize, 10) : config.MIN_SQUAD_SIZE;
                    newSettings.minFemalePlayers = loadedMinFemale !== undefined ? parseInt(loadedMinFemale, 10) : config.MIN_FEMALE_PLAYERS;
                     if (loadedSubSpaceReqsJSON) {
                        try {
                            newSettings.subSpaceRequirements = JSON.parse(loadedSubSpaceReqsJSON);
                        } catch {
                            newSettings.subSpaceRequirements = config.SUB_SPACE_REQUIREMENTS;
                        }
                    } else {
                        newSettings.subSpaceRequirements = config.SUB_SPACE_REQUIREMENTS;
                    }
                    setSettings(newSettings);

                    const loadedCurrentPlayerId = metadata.find(r => r.key === 'currentPlayerId')?.value;
                    const loadedCurrentBid = metadata.find(r => r.key === 'currentBid')?.value;
                    const loadedHighestBidder = metadata.find(r => r.key === 'highestBidder')?.value;
                    const loadedCurrentBidHistoryJSON = metadata.find(r => r.key === 'currentBidHistory')?.value;
                    const loadedTradeOffersJSON = metadata.find(r => r.key === 'tradeOffers')?.value;
                    const loadedTradeNegotiationStateJSON = metadata.find(r => r.key === 'tradeNegotiationState')?.value;

                    // 2. Read Player Data
                    const resultsSheet = workbook.Sheets['Auction Results'];
                    if (!resultsSheet) throw new Error("Invalid export file: Missing 'Auction Results' sheet.");
                    const loadedPlayers = XLSX.utils.sheet_to_json(resultsSheet);
                    
                    // 3. Reformat players back to internal structure
                    const allPlayersFormatted: Player[] = loadedPlayers.map((player, index) => ({
                        id: player.empId || index,
                        name: player.Name,
                        empId: player.empId,
                        email: player.email,
                        location: player['Office Location'],
                        gender: player.Gender,
                        subSpace: player['Sub-Space'],
                        options: {
                           social: [player.Social_Option1, player.Social_Option2, player.Social_Option3].map(parseSkill).filter(Boolean) as Skill[],
                           indoor: [player.Indoor_Option1, player.Indoor_Option2].map(parseSkill).filter(Boolean) as Skill[],
                           outdoor: [player.Outdoor_Option1, player.Outdoor_Option2, player.Outdoor_Option3].map(parseSkill).filter(Boolean) as Skill[],
                           cultural: [player.Cultural_Option1, player.Cultural_Option2].map(parseSkill).filter(Boolean) as Skill[],
                        },
                        'Assigned Squad': player['Assigned Squad'],
                        'Sold Price': player['Sold Price'] || 0,
                        boughtFrom: player['Bought From'] || undefined
                    }));

                    // 4. Reconstruct state
                    const newSquads = Array.from({ length: config.SQUAD_COUNT }, (_, i) => ({
                        id: i + 1,
                        name: `Squad ${i + 1}`,
                        budget: config.INITIAL_BUDGET,
                        players: [],
                    }));
                    const newPlayersPool = [];
                    const newUnsoldPlayers = [];

                    allPlayersFormatted.forEach(p => {
                        const squadName = p['Assigned Squad'];
                        const soldPrice = p['Sold Price'];
                        const playerForSquad = { ...p, soldPrice: soldPrice };

                        if (squadName && squadName !== 'Unsold' && squadName !== 'Not Auctioned') {
                            const squad = newSquads.find(s => s.name === squadName);
                            if (squad) {
                                squad.players.push(playerForSquad);
                                squad.budget -= soldPrice;
                            }
                        } else if (squadName === 'Unsold') {
                            newUnsoldPlayers.push(p);
                        } else {
                            newPlayersPool.push(p);
                        }
                    });

                    // 5. Update React state
                    setAllPlayers(allPlayersFormatted);
                    setUnsoldPlayers(newUnsoldPlayers.sort((a, b) => a.name.localeCompare(b.name)));
                    setSquads(newSquads);
                    try {
                        setTradeOffers(loadedTradeOffersJSON ? JSON.parse(loadedTradeOffersJSON) : []);
                    } catch {
                        setTradeOffers([]);
                    }
                    try {
                        setTradeNegotiationState(loadedTradeNegotiationStateJSON ? JSON.parse(loadedTradeNegotiationStateJSON) : { status: 'collecting', currentPlayerIndex: -1 });
                    } catch {
                        setTradeNegotiationState({ status: 'collecting', currentPlayerIndex: -1 });
                    }
                    
                    setAuctionStarted(true);
                    setFileName(file.name);
                    setHistory([]);
                    setError('');
                    
                    // 6. Resume auction flow
                    if (loadedCurrentPlayerId != null) {
                        const playerToSetAsCurrent = allPlayersFormatted.find(p => p.id === loadedCurrentPlayerId);
                        if (playerToSetAsCurrent) {
                            // Player was being auctioned, restore state
                            const finalPlayersPool = newPlayersPool.filter(p => p.id !== loadedCurrentPlayerId);
                            setPlayers(finalPlayersPool.sort((a, b) => a.name.localeCompare(b.name)));
                            
                            setCurrentPlayer(playerToSetAsCurrent);
                            setCurrentBid(loadedCurrentBid || BASE_PRICE);
                            setHighestBidder(loadedHighestBidder || null);
                            try {
                                setCurrentBidHistory(loadedCurrentBidHistoryJSON ? JSON.parse(loadedCurrentBidHistoryJSON) : []);
                            } catch {
                                setCurrentBidHistory([]);
                            }
    
                            // Start timer based on loaded state
                            const duration = loadedHighestBidder ? settings.bidDuration : settings.initialDuration;
                            setTimerDuration(duration);
                            setTimerValue(duration);
                            setTimerKey(prev => prev + 1);
                            setIsTimerRunning(true);
                            setAuctionOver(finalPlayersPool.length === 0 && !playerToSetAsCurrent);
                        } else {
                             // Fallback: couldn't find player, just start with next random
                            const sortedPlayerPool = newPlayersPool.sort((a, b) => a.name.localeCompare(b.name));
                            setPlayers(sortedPlayerPool);
                            selectNextPlayer(sortedPlayerPool);
                        }
                    } else {
                        // Original behavior: auction was over or between players
                        const sortedPlayerPool = newPlayersPool.sort((a, b) => a.name.localeCompare(b.name));
                        setPlayers(sortedPlayerPool);
                        selectNextPlayer(sortedPlayerPool);
                    }
                }
            } catch (err) {
                console.error("Failed to load from export:", err);
                setError(err.message || "Failed to load state from the provided file.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleSearch = (query) => {
        setSearchQuery(query);
    
        if (!query || query.trim() === '') {
            setSearchResult(null);
            return;
        }
    
        const lowerCaseQuery = query.toLowerCase().trim();
        let found = false;
    
        // 1. Check current player
        if (currentPlayer && currentPlayer.name.toLowerCase().includes(lowerCaseQuery)) {
            setSearchResult({ player: currentPlayer, status: 'current' });
            found = true;
        }
    
        // 2. Check sold players
        if (!found) {
            for (const squad of squads) {
                const foundPlayer = squad.players.find(p => p.name.toLowerCase().includes(lowerCaseQuery));
                if (foundPlayer) {
                    setSearchResult({ player: foundPlayer, status: 'sold', squadId: squad.id });
                    found = true;
                    break;
                }
            }
        }
        
        // 3. Check unsold players
        if (!found) {
            const foundUnsold = unsoldPlayers.find(p => p.name.toLowerCase().includes(lowerCaseQuery));
            if (foundUnsold) {
                setSearchResult({ player: foundUnsold, status: 'unsold' });
                found = true;
            }
        }
    
        // 4. Check upcoming players
        if (!found) {
            const foundUpcoming = players.find(p => p.name.toLowerCase().includes(lowerCaseQuery));
            if (foundUpcoming) {
                setSearchResult({ player: foundUpcoming, status: 'upcoming' });
                found = true;
            }
        }
        
        if (!found) {
            setSearchResult({ player: null, status: 'not_found', query: query });
        }
    };
    
    const SearchResultDisplay = ({ result }) => {
        if (!result || !searchQuery) return null;
    
        if (result.status === 'not_found') {
            return <div className="card search-result-card">Player "{result.query}" not found.</div>;
        }
        
        const { player, status, squadId } = result;
        let message = '';
        switch(status) {
            case 'current':
                message = `is currently being auctioned.`;
                break;
            case 'sold':
                const squadName = squads.find(s => s.id === squadId)?.name || '';
                message = `was sold to ${squadName}.`;
                break;
            case 'unsold':
                message = `is in the unsold list.`;
                break;
            case 'upcoming':
                message = `is yet to be auctioned.`;
                break;
        }
        
        return (
            <div className="card search-result-card">
                <strong>{player.name}</strong> {message}
            </div>
        );
    };

    // FIX: Define prop types for RosterModal to resolve TypeScript error on `squad.players.map`.
    interface RosterModalProps {
        squad: {
            name: string;
            players: Player[];
        };
        onClose: () => void;
        onPlayerHistoryClick: (player: Player) => void;
        isUnsoldList?: boolean;
    }

    const RosterModal: React.FC<RosterModalProps> = ({ squad, onClose, onPlayerHistoryClick, isUnsoldList = false }) => {
        const [activeTab, setActiveTab] = useState('breakdown');
    
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>{squad.name} Roster ({squad.players.length}{!isUnsoldList && `/${minSquadSize}`})</h3>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <div className="modal-tabs">
                            <button className={`tab-button ${activeTab === 'breakdown' ? 'active' : ''}`} onClick={() => setActiveTab('breakdown')}>Skill Breakdown</button>
                            <button className={`tab-button ${activeTab === 'list' ? 'active' : ''}`} onClick={() => setActiveTab('list')}>Player List</button>
                        </div>
                        <div className="modal-tab-content">
                            {activeTab === 'breakdown' && <SkillBreakdown players={squad.players} />}
                            {activeTab === 'list' && (
                                <>
                                    {squad.players.length > 0 ? (
                                        <div className="roster-table-container">
                                            <table className="roster-table">
                                                <thead>
                                                    <tr>
                                                        <th>Name</th>
                                                        <th>Price</th>
                                                        <th>Gender</th>
                                                        <th>Sub-Space</th>
                                                        <th>Skills</th>
                                                        <th>History</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                {squad.players.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                                                    <tr key={p.id}>
                                                        <td data-label="Name">{p.name}</td>
                                                        <td data-label="Price" className="price-cell">{formatCurrency(p.soldPrice)}</td>
                                                        <td data-label="Gender">{p.gender}</td>
                                                        <td data-label="Sub-Space">{p.subSpace}</td>
                                                        <td data-label="Skills" className="skills-cell">
                                                            <div className="player-options-tags">
                                                                {p.options.social.map(skill => <span key={skill.name} className="tag social">{SkillIcons.social}{skill.name} ({skill.score})</span>)}
                                                                {p.options.indoor.map(skill => <span key={skill.name} className="tag indoor">{SkillIcons.indoor}{skill.name} ({skill.score})</span>)}
                                                                {p.options.outdoor.map(skill => <span key={skill.name} className="tag outdoor">{SkillIcons.outdoor}{skill.name} ({skill.score})</span>)}
                                                                {p.options.cultural.map(skill => <span key={skill.name} className="tag cultural">{SkillIcons.cultural}{skill.name} ({skill.score})</span>)}
                                                            </div>
                                                        </td>
                                                         <td data-label="History">
                                                            <button
                                                                className="btn-icon"
                                                                title="View Bid History"
                                                                onClick={() => onPlayerHistoryClick(p)}
                                                                disabled={!p.bidHistory || p.bidHistory.length === 0}
                                                            >
                                                                 <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="history-icon"><path d="M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z"/></svg>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    ) : <p>No players yet.</p>}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const ConfirmationModal = ({ title, message, onConfirm, onCancel, confirmButtonText, confirmButtonClass }) => (
        <div className="modal-overlay" onClick={onCancel}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>{title}</h3>
                    <button className="close-button" onClick={onCancel}>&times;</button>
                </div>
                <div className="modal-body">
                    <p>{message}</p>
                </div>
                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onCancel}>Cancel</button>
                    <button className={`btn ${confirmButtonClass || 'btn-primary'}`} onClick={onConfirm}>
                        {confirmButtonText || 'Confirm'}
                    </button>
                </div>
            </div>
        </div>
    );
    
    const AuctionAnimationOverlay = ({ animation, onAnimationEnd, formatCurrency }) => {
        const { type, price, squadName } = animation;
        const player = currentPlayer; // Capture current player for display

        React.useEffect(() => {
            if (type) {
                const timer = setTimeout(() => {
                    onAnimationEnd();
                }, 2500); // Animation duration should match CSS
                return () => clearTimeout(timer);
            }
        }, [type, onAnimationEnd]);

        if (!type || !player) return null;

        const isSold = type === 'sold';
        const message = isSold ? `SOLD TO ${squadName}` : 'UNSOLD';
        const priceDisplay = isSold ? formatCurrency(price) : '';

        return (
            <div className={`animation-overlay ${isSold ? 'sold' : 'unsold'}`}>
                <div className="animation-content">
                    <h1>{player.name}</h1>
                    <p className="animation-status">{message}</p>
                    {isSold && <p className="animation-price">{priceDisplay}</p>}
                </div>
            </div>
        );
    };

    const NegotiationAnimationOverlay = ({ animation, onAnimationEnd, formatCurrency, squads }) => {
        const { type, offer, price } = animation;
    
        React.useEffect(() => {
            if (type) {
                const timer = setTimeout(() => {
                    onAnimationEnd();
                }, 2500); // Animation duration should match CSS
                return () => clearTimeout(timer);
            }
        }, [type, onAnimationEnd]);
    
        if (!type || !offer) return null;
    
        const player = getPlayerFromPool(offer.playerId);
        const owningSquad = squads.find(s => s.id === offer.owningSquadId);
        const requestingSquad = squads.find(s => s.id === offer.requestingSquadId);
    
        let message = '';
        let priceDisplay = '';
        let secondaryMessage = '';
    
        switch (type) {
            case 'accepted':
                message = `TRADE ACCEPTED`;
                priceDisplay = formatCurrency(price);
                secondaryMessage = `${requestingSquad?.name || ''} acquires ${player?.name || ''}`;
                playSound('sold');
                break;
            case 'rejected':
                message = 'OFFER REJECTED';
                secondaryMessage = `Offer from ${requestingSquad?.name || ''} for ${player?.name || ''}`;
                break;
            case 'countered':
                message = 'COUNTER OFFER';
                priceDisplay = formatCurrency(price);
                secondaryMessage = `${owningSquad?.name || ''} counters for ${player?.name || ''}`;
                break;
        }
    
        return (
            <div className={`animation-overlay ${type}`}>
                <div className="animation-content">
                    <p className="animation-status">{message}</p>
                    {player && <h1>{player.name}</h1>}
                    {priceDisplay && <p className="animation-price">{priceDisplay}</p>}
                    {secondaryMessage && <p className="animation-secondary">{secondaryMessage}</p>}
                </div>
            </div>
        );
    };

    const BidHistoryModal = ({ player, squads, onClose }) => {
        if (!player) return null;

        const getSquadName = (squadId) => squads.find(s => s.id === squadId)?.name || `Squad ${squadId}`;

        const finalBid = player.bidHistory?.[player.bidHistory.length - 1];
        const winningSquadName = finalBid ? getSquadName(finalBid.squadId) : 'N/A';
    
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content bid-history-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Bid History: {player.name}</h3>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        {player.bidHistory && player.bidHistory.length > 0 ? (
                            <div className="bid-history-container">
                                <ul className="bid-history-list">
                                    {player.bidHistory.map((bid, index) => (
                                        <li key={index} className={`bid-history-item ${index === player.bidHistory.length - 1 ? 'winning-bid' : ''}`}>
                                            <span className="bid-squad-name">{getSquadName(bid.squadId)}</span>
                                            <div className="bid-line"></div>
                                            <span className="bid-amount">{formatCurrency(bid.bidAmount)}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="bid-summary">
                                    Sold to <strong>{winningSquadName}</strong> for <strong>{formatCurrency(player.soldPrice)}</strong>
                                </div>
                            </div>
                        ) : (
                            <p className="no-history-placeholder">No competitive bidding history was recorded for this player.</p>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    const BulkAssignModal = ({ isOpen, onClose, onConfirm, unsoldPlayers, squads, config }) => {
        const { BASE_PRICE, minSquadSize } = config;
        const [assignments, setAssignments] = useState<{ [playerId: string]: { squadId: number | null, price: number } }>({});

        useEffect(() => {
            if (isOpen) {
                // Reset assignments when modal is opened
                const initialAssignments = unsoldPlayers.reduce((acc, p) => ({ ...acc, [p.id]: { squadId: null, price: BASE_PRICE } }), {});
                setAssignments(initialAssignments);
            }
        }, [isOpen, unsoldPlayers, BASE_PRICE]);

        const handleAssignmentChange = (playerId, squadId) => {
            setAssignments(prev => ({
                ...prev,
                [playerId]: { ...prev[playerId], squadId: squadId ? parseInt(squadId, 10) : null }
            }));
        };

        const handlePriceChange = (playerId, newPrice) => {
            const price = parseInt(newPrice, 10);
            if (!isNaN(price) && price >= BASE_PRICE) {
                setAssignments(prev => ({
                    ...prev,
                    [playerId]: { ...prev[playerId], price: price }
                }));
            }
        };

        const validationResults = useMemo(() => {
            let overallIsValid = true;
            const summary = squads.map(squad => {
                 const assignmentsForSquad = Object.entries(assignments)
                    .filter(([, assignment]) => assignment.squadId === squad.id);
                
                const playersToAssign = assignmentsForSquad.map(([playerId]) => 
                    unsoldPlayers.find(p => p.id.toString() === playerId)
                );
                
                const cost = assignmentsForSquad.reduce((sum, [, assignment]) => {
                    return sum + (assignment.price || 0);
                }, 0);

                const projectedBudget = squad.budget - cost;
                const projectedPlayerCount = squad.players.length + playersToAssign.length;
                const remainingSlotsAfterBulk = minSquadSize - projectedPlayerCount;
                const budgetForRemainingSlots = remainingSlotsAfterBulk > 0 ? remainingSlotsAfterBulk * BASE_PRICE : 0;

                const errors = [];
                if (projectedBudget < 0) {
                    errors.push(`Exceeds budget by ${formatCurrency(Math.abs(projectedBudget))}.`);
                }
                if (projectedBudget < budgetForRemainingSlots) {
                    errors.push(`Assignment prevents meeting minimum roster size.`);
                }
                
                if (errors.length > 0) {
                    overallIsValid = false;
                }

                return {
                    squadId: squad.id,
                    squadName: squad.name,
                    playersToAssignCount: playersToAssign.length,
                    cost,
                    projectedBudget,
                    errors,
                };
            });

            return { summary, overallIsValid };
        }, [assignments, squads, unsoldPlayers, BASE_PRICE, minSquadSize, formatCurrency]);

        if (!isOpen) return null;

        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content bulk-assign-modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Bulk Assign Unsold Players</h3>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <div className="bulk-assign-layout">
                            <div className="player-assignment-list">
                                <h4>Unsold Players ({unsoldPlayers.length})</h4>
                                <div className="player-assignment-table-container">
                                    <table className="player-assignment-table">
                                        <thead>
                                            <tr>
                                                <th>Player Name</th>
                                                <th className="assign-cell">Assign to Squad</th>
                                                <th className="price-cell">Price</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {unsoldPlayers.sort((a,b) => a.name.localeCompare(b.name)).map(player => (
                                                <tr key={player.id}>
                                                    <td>{player.name}</td>
                                                    <td className="assign-cell">
                                                        <select
                                                            value={assignments[player.id]?.squadId || ''}
                                                            onChange={(e) => handleAssignmentChange(player.id, e.target.value)}
                                                        >
                                                            <option value="">Do Not Assign</option>
                                                            {squads.map(squad => (
                                                                <option key={squad.id} value={squad.id}>
                                                                    {squad.name} ({formatCurrency(squad.budget)})
                                                                </option>
                                                            ))}
                                                        </select>
                                                    </td>
                                                    <td className="price-cell">
                                                        <input
                                                            type="number"
                                                            className="price-input"
                                                            value={assignments[player.id]?.price || BASE_PRICE}
                                                            min={BASE_PRICE}
                                                            step="10000"
                                                            onChange={(e) => handlePriceChange(player.id, e.target.value)}
                                                            disabled={!assignments[player.id]?.squadId}
                                                        />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                            <div className="assignment-summary-panel">
                                <h4>Summary & Validation</h4>
                                <div className="assignment-summary-scroll-container">
                                    <div className="summary-list">
                                        {validationResults.summary.filter(s => s.playersToAssignCount > 0).map(s => (
                                            <div key={s.squadId} className="summary-squad-item">
                                                <div className="summary-squad-item-header">
                                                    <span>{s.squadName}</span>
                                                    <span>{s.errors.length > 0 ? 'Invalid' : 'Valid'}</span>
                                                </div>
                                                <div className="summary-details">
                                                    <span>Players to Add: <strong>{s.playersToAssignCount}</strong></span>
                                                    <span>Total Cost: <strong>{formatCurrency(s.cost)}</strong></span>
                                                    <span>Projected Budget: <strong>{formatCurrency(s.projectedBudget)}</strong></span>
                                                </div>
                                                {s.errors.length > 0 && (
                                                    <div className="summary-validation">
                                                        {s.errors.map((err, i) => (
                                                             <p key={i} className="summary-validation-error">{err}</p>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button
                            className="btn btn-primary"
                            onClick={() => onConfirm(assignments)}
                            disabled={!validationResults.overallIsValid}
                        >
                            Confirm Assignments
                        </button>
                    </div>
                </div>
            </div>
        );
    };
    
    const SettingsModal = ({ isOpen, onClose, onSave, currentSettings, subSpaceDisplayNames }) => {
        const [localSettings, setLocalSettings] = React.useState(currentSettings);

        React.useEffect(() => {
            if (isOpen) {
                setLocalSettings(currentSettings);
            }
        }, [currentSettings, isOpen]);

        const handleSave = () => {
            onSave({
                ...localSettings,
                initialDuration: parseInt(String(localSettings.initialDuration), 10) || 20,
                bidDuration: parseInt(String(localSettings.bidDuration), 10) || 10,
                negotiationDuration: parseInt(String(localSettings.negotiationDuration), 10) || 30,
                minSquadSize: parseInt(String(localSettings.minSquadSize), 10) || 40,
                minFemalePlayers: parseInt(String(localSettings.minFemalePlayers), 10) || 6,
                subSpaceRequirements: {
                    Analytics: parseInt(String(localSettings.subSpaceRequirements.Analytics), 10) || 0,
                    Tech: parseInt(String(localSettings.subSpaceRequirements.Tech), 10) || 0,
                    Marketing: parseInt(String(localSettings.subSpaceRequirements.Marketing), 10) || 0,
                },
                autoExportEnabled: localSettings.autoExportEnabled,
            });
            onClose();
        };

        if (!isOpen) return null;

        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content settings-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Settings</h3>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <div className="settings-form">
                             <div className="settings-section">
                                <h4>Auction & Timer Rules</h4>
                                <div className="form-group">
                                    <label htmlFor="initialDuration">Initial Timer (seconds)</label>
                                    <p>Time for the first bid on a new player.</p>
                                    <input
                                        type="number"
                                        id="initialDuration"
                                        value={localSettings.initialDuration}
                                        onChange={(e) => setLocalSettings({ ...localSettings, initialDuration: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="bidDuration">Bid Reset Timer (seconds)</label>
                                    <p>Time reset after each subsequent bid.</p>
                                    <input
                                        type="number"
                                        id="bidDuration"
                                        value={localSettings.bidDuration}
                                        onChange={(e) => setLocalSettings({ ...localSettings, bidDuration: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="negotiationDuration">Negotiation Timer (seconds)</label>
                                    <p>Time for each action during trade negotiations (accept, reject, counter).</p>
                                    <input
                                        type="number"
                                        id="negotiationDuration"
                                        value={localSettings.negotiationDuration}
                                        onChange={(e) => setLocalSettings({ ...localSettings, negotiationDuration: e.target.value })}
                                    />
                                </div>
                                <div className="form-group toggle-group">
                                    <div className="toggle-label-group">
                                        <label htmlFor="autoExportEnabled">Enable Auto-Export</label>
                                        <p>Automatically export results after each player is sold or unsold.</p>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            id="autoExportEnabled"
                                            checked={localSettings.autoExportEnabled}
                                            onChange={(e) => setLocalSettings({ ...localSettings, autoExportEnabled: e.target.checked })}
                                        />
                                        <span className="slider"></span>
                                    </label>
                                </div>
                             </div>

                             <div className="settings-section">
                                <h4>Squad Composition Rules</h4>
                                <div className="form-group">
                                    <label htmlFor="minSquadSize">Minimum Squad Size</label>
                                    <input
                                        type="number" id="minSquadSize"
                                        value={localSettings.minSquadSize}
                                        onChange={(e) => setLocalSettings({ ...localSettings, minSquadSize: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label htmlFor="minFemalePlayers">Minimum Female Players</label>
                                    <input
                                        type="number" id="minFemalePlayers"
                                        value={localSettings.minFemalePlayers}
                                        onChange={(e) => setLocalSettings({ ...localSettings, minFemalePlayers: e.target.value })}
                                    />
                                </div>
                                {/* FIX: Use the typed `subSpaceKeys` array for iteration to prevent type errors. */}
                                {subSpaceKeys.map(key => (
                                     <div className="form-group" key={key}>
                                        <label htmlFor={`min-${key}`}>Min. {subSpaceDisplayNames[key]} Players</label>
                                        <input
                                            type="number" id={`min-${key}`}
                                            value={localSettings.subSpaceRequirements[key]}
                                            onChange={(e) => setLocalSettings(prev => ({
                                                ...prev,
                                                subSpaceRequirements: { ...prev.subSpaceRequirements, [key]: e.target.value }
                                            }))}
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleSave}>Save Settings</button>
                    </div>
                </div>
            </div>
        );
    };

    const TimerDisplay = ({ duration, value, key }) => {
        const radius = 45;
        const circumference = 2 * Math.PI * radius;
        // Ensure progress doesn't go below 0
        const progress = Math.max(0, value) / duration;
        const offset = circumference * (1 - progress);
    
        let strokeColorClass = 'progress-normal';
        if (value <= 5) strokeColorClass = 'progress-danger';
        else if (value <= 10) strokeColorClass = 'progress-warning';
        
        const isPulsing = isTimerRunning && value <= 5;

        return (
            <div className={`timer-display ${isPulsing ? 'pulsing' : ''}`} key={key}>
                <svg className="timer-svg" width="100" height="100" viewBox="0 0 100 100">
                    <circle className="timer-circle-bg" cx="50" cy="50" r={radius}></circle>
                    <circle
                        className={`timer-circle-progress ${strokeColorClass}`}
                        cx="50"
                        cy="50"
                        r={radius}
                        strokeDasharray={circumference}
                        style={{ strokeDashoffset: offset }}
                    ></circle>
                </svg>
                <div className={`timer-value ${isPulsing ? 'pulsing' : ''}`}>{value}</div>
            </div>
        );
    };

    const SkillIcons = {
        social: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="skill-icon">
                <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
            </svg>
        ),
        indoor: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="skill-icon">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
            </svg>
        ),
        outdoor: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="skill-icon">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zM12 4c.94 0 1.82.26 2.58.72L12 7.5V4zm0 5.5l5.22-3.13C18.25 7.4 19 8.62 19 10c0 1.05-.33 2.01-.89 2.8L12 9.5zM4.5 12c0-1.74 1.01-3.23 2.45-3.95L12 11.5V20c-4.41 0-8-3.59-8-8zm7.5 6.55V13l6.05 3.63c-.8.88-1.86 1.57-3.05 1.92z"/>
            </svg>
        ),
        cultural: (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="skill-icon">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
            </svg>
        )
    };

    const PlayerStatIcons = {
        id: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
        gender: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 4c-4.42 0-8 3.58-8 8s3.58 8 8 8 8-3.58 8-8-3.58-8-8-8zm0 1.5c1.45 0 2.8.48 3.93 1.28L6.78 17.93A6.45 6.45 0 0 1 5.5 12c0-3.58 2.92-6.5 6.5-6.5zm0 13c-1.45 0-2.8-.48-3.93-1.28L17.22 6.07A6.45 6.45 0 0 1 18.5 12c0 3.58-2.92 6.5-6.5 6.5z"/></svg>,
        location: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5-2.5z"/></svg>,
        subspace: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 7V3H2v18h20V7H12zM6 19H4v-2h2v2zm0-4H4v-2h2v2zm0-4H4V9h2v2zm0-4H4V5h2v2zm4 12H8v-2h2v2zm0-4H8v-2h2v2zm0-4H8V9h2v2zm0-4H8V5h2v2zm10 12h-8v-2h2v-2h-2v-2h2v-2h-2V9h8v10zm-2-8h-2v2h2v-2zm0 4h-2v2h2v-2z"/></svg>,
        email: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>,
    };

    const Avatar = ({ name }) => {
        if (!name) return <div className="avatar-container" style={{ backgroundColor: '#555' }}></div>;
    
        const getInitials = (nameStr) => {
            const parts = nameStr.split(' ');
            if (parts.length > 1) {
                return (parts[0][0] || '') + (parts[parts.length - 1][0] || '');
            }
            return nameStr.substring(0, 2);
        };
    
        const stringToColor = (str) => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = str.charCodeAt(i) + ((hash << 5) - hash);
            }
            let color = '#';
            for (let i = 0; i < 3; i++) {
                const value = (hash >> (i * 8)) & 0xFF;
                color += ('00' + value.toString(16)).substr(-2);
            }
            return color;
        };
    
        const initials = getInitials(name).toUpperCase();
        const bgColor = stringToColor(name);
    
        return (
            <div className="avatar-container" style={{ backgroundColor: bgColor }}>
                <span className="avatar-initials">{initials}</span>
            </div>
        );
    };
    
    const playSound = (type: 'bid' | 'sold' | 'tick') => {
        // Lazily create AudioContext on first user interaction to comply with browser autoplay policies.
        if (!audioCtxRef.current) {
            try {
                const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
                if (AudioContext) {
                    audioCtxRef.current = new AudioContext();
                } else {
                    console.error("Web Audio API is not supported in this browser.");
                    return;
                }
            } catch (e) {
                console.error("Could not create AudioContext.", e);
                return;
            }
        }

        const audioCtx = audioCtxRef.current;
        if (!audioCtx) {
            return;
        }

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);

        switch (type) {
            case 'bid':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
                gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
                break;
            case 'sold':
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(523.25, audioCtx.currentTime);
                gainNode.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.01);
                gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);

                const oscillator2 = audioCtx.createOscillator();
                const gainNode2 = audioCtx.createGain();
                oscillator2.connect(gainNode2);
                gainNode2.connect(audioCtx.destination);
                gainNode2.gain.setValueAtTime(0, audioCtx.currentTime);
                oscillator2.type = 'sine';
                oscillator2.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
                gainNode2.gain.linearRampToValueAtTime(0.4, audioCtx.currentTime + 0.11);
                gainNode2.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.25);
                oscillator2.start(audioCtx.currentTime + 0.1);
                oscillator2.stop(audioCtx.currentTime + 0.3);
                break;
            case 'tick':
                 oscillator.type = 'triangle';
                 oscillator.frequency.setValueAtTime(1200, audioCtx.currentTime);
                 gainNode.gain.linearRampToValueAtTime(0.15, audioCtx.currentTime + 0.01);
                 gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.05);
                 break;
        }

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.3);
    };

    const SkillBreakdown = ({ players }) => {
        const [skillStats, setSkillStats] = React.useState({ social: {}, indoor: {}, outdoor: {}, cultural: {} });
    
        React.useEffect(() => {
            const stats = { social: {}, indoor: {}, outdoor: {}, cultural: {} };
    
            players.forEach(player => {
                Object.keys(stats).forEach((category: 'social' | 'indoor' | 'outdoor' | 'cultural') => {
                    player.options[category]?.forEach(skill => {
                        if (!stats[category][skill.name]) {
                            stats[category][skill.name] = { totalScore: 0, count: 0, average: 0 };
                        }
                        stats[category][skill.name].totalScore += skill.score;
                        stats[category][skill.name].count++;
                    });
                });
            });
    
            // Calculate averages
            Object.values(stats).forEach(category => {
                Object.values(category).forEach((skillData: any) => {
                    if (skillData.count > 0) {
                        skillData.average = skillData.totalScore / skillData.count;
                    }
                });
            });
    
            setSkillStats(stats);
        }, [players]);
    
        const categories = [
            { name: 'social', title: 'Social', icon: SkillIcons.social },
            { name: 'indoor', title: 'Indoor', icon: SkillIcons.indoor },
            { name: 'outdoor', title: 'Outdoor', icon: SkillIcons.outdoor },
            { name: 'cultural', title: 'Cultural', icon: SkillIcons.cultural },
        ];
    
        const hasAnySkills = categories.some(cat => Object.keys(skillStats[cat.name]).length > 0);
    
        return (
            <div className="skill-breakdown-container">
                <h4>Skill Breakdown</h4>
                {!hasAnySkills && <p className="no-skills-placeholder">No skills to display.</p>}
                {categories.map(category => {
                    const skillsInCategory = Object.entries(skillStats[category.name]).sort(([, a]: [string, any], [, b]: [string, any]) => b.average - a.average);
                    if (skillsInCategory.length === 0) return null;
    
                    return (
                        <div key={category.name} className={`skill-category ${category.name}`}>
                            <div className="skill-category-header">
                                {category.icon}
                                <h5>{category.title}</h5>
                            </div>
                            <ul className="skill-list">
                                {skillsInCategory.map(([skillName, data]: [string, any]) => (
                                    <li key={skillName} className="skill-item">
                                        <span className="skill-name" title={skillName}>{skillName}</span>
                                        <div className="skill-bar-container" title={`Average score: ${data.average.toFixed(1)}`}>
                                            <div 
                                                className="skill-bar" 
                                                style={{ width: `${(data.average / 10) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="skill-count" title={`${data.count} players`}>
                                            {data.average.toFixed(1)} ({data.count})
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    );
                })}
            </div>
        );
    };

    const SquadComparisonModal = ({ isOpen, onClose, allSquads, squadIdsToCompare, config, formatCurrency, subSpaceDisplayNames }) => {
        const Icons = {
            budget: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M21.41 11.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.1 0-2 .9-2 2v7c0 .55.22 1.05.59 1.42l9 9c.36.36.86.58 1.41.58s1.05-.22 1.41-.59l7-7c.37-.36.59-.86.59-1.41s-.22-1.05-.59-1.42zM13 20.01L4 11V4h7v-.01l9 9-7 7.01z"/><circle cx="6.5" cy="6.5" r="1.5"/></svg>,
            spend: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-2-9h4v2h-4v-2zm-2-2h8v2h-8v-2zm4-3c-.55 0-1 .45-1 1v1h2V7c0-.55-.45-1-1-1z"/></svg>,
            avg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>,
            roster: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>,
            female: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2m0 10c-2.7 0-5.8 1.29-6 2h12c-.2-.71-3.3-2-6-2M12 4C9.79 4 8 5.79 8 8s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm0 10c-3.33 0-10 1.67-10 5v2h20v-2c0-3.33-6.67-5-10-5z"/></svg>,
            subspace: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm-5.14 9A8.02 8.02 0 0 1 4 12c0-2.05.78-3.9 2.05-5.32L10.99 12l-4.13 4zM12 20c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-2c3.31 0 6-2.69 6-6s-2.69-6-6-6-6 2.69-6 6 2.69 6 6 6zm4.14-9s-1.05 3.32-1.05 3.32L12 12l4.14-3z"/></svg>,
            star: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>,
            trophy: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-3.5-3.5 1.41-1.41L11 15.17l5.59-5.59L18 11l-7 7z"/></svg>
        };
    
        const ComparisonProgressBar = ({ value, max, format, isBest }) => {
            const percentage = max > 0 ? (value / max) * 100 : 0;
            const isComplete = value >= max;
            
            return (
                <div className={`comparison-progress-bar ${isComplete ? 'complete' : ''} ${isBest ? 'is-best' : ''}`}>
                    <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${percentage}%` }}></div>
                    </div>
                    <div className="progress-bar-text">{format(value)} / {format(max, true)}</div>
                </div>
            );
        };
        
        const SkillProfile = ({ squads, maxSkillValue }) => {
            const RadarChart = ({ stats, maxStatValue, size = 100 }) => {
                const center = size / 2;
                const radius = size * 0.4;
        
                const getPoint = (value, index) => {
                    const angle = (Math.PI / 2) * index - Math.PI / 2;
                    const percentage = maxStatValue > 0 ? value / maxStatValue : 0;
                    const x = center + radius * percentage * Math.cos(angle);
                    const y = center + radius * percentage * Math.sin(angle);
                    return `${x},${y}`;
                };
        
                const points = [
                    stats.outdoor, stats.cultural, stats.indoor, stats.social,
                ].map(getPoint).join(' ');
        
                return (
                    <div className="skill-profile-chart">
                        <svg viewBox={`0 0 ${size} ${size}`}>
                            <g className="radar-chart-grid">
                                {[0.25, 0.5, 0.75, 1].map(r => <circle key={r} cx={center} cy={center} r={radius * r} />)}
                                <line x1={center} y1={center - radius} x2={center} y2={center + radius} />
                                <line x1={center - radius} y1={center} x2={center + radius} y2={center} />
                            </g>
                            <polygon className="radar-chart-shape" points={points} />
                        </svg>
                    </div>
                );
            };
            
            return (
                <tr className="metric-row">
                    <td className="metric-label-cell">
                        <div className="metric-label-content">
                            <div className="metric-icon">{SkillIcons.social}</div>
                            <div className="metric-info">
                                <span className="metric-label-title">Skill Profile</span>
                                <span className="metric-description">Total skill points distribution.</span>
                            </div>
                        </div>
                        <div className="radar-legend">
                           <span>{SkillIcons.outdoor} Outdoor</span> 
                           <span>{SkillIcons.cultural} Cultural</span> 
                           <span>{SkillIcons.indoor} Indoor</span> 
                           <span>{SkillIcons.social} Social</span> 
                        </div>
                    </td>
                    {squads.map(s => (
                        <td key={s.id} className="metric-value-cell">
                            <RadarChart stats={s.skillTotals} maxStatValue={maxSkillValue} />
                        </td>
                    ))}
                </tr>
            );
        };
    
        const comparedSquads = React.useMemo(() => {
            return squadIdsToCompare.map(id => {
                const squad = allSquads.find(s => s.id === id);
                if (!squad) return null;
    
                const { femaleCount, subSpaceCounts } = getSquadStats(squad);
                const totalSpend = squad.players.reduce((sum, p) => sum + (p.soldPrice || 0), 0);
                const avgPrice = squad.players.length > 0 ? totalSpend / squad.players.length : 0;
                const starPlayer = squad.players.length > 0 
                    ? squad.players.reduce((max, p) => (p.soldPrice || 0) > (max.soldPrice || 0) ? p : max, squad.players[0])
                    : null;
                
                const skillTotals = { social: 0, indoor: 0, outdoor: 0, cultural: 0 };
                squad.players.forEach(p => {
                    skillTotals.social += p.options.social.reduce((sum, s) => sum + s.score, 0);
                    skillTotals.indoor += p.options.indoor.reduce((sum, s) => sum + s.score, 0);
                    skillTotals.outdoor += p.options.outdoor.reduce((sum, s) => sum + s.score, 0);
                    skillTotals.cultural += p.options.cultural.reduce((sum, s) => sum + s.score, 0);
                });
    
                return {
                    ...squad,
                    femaleCount,
                    subSpaceCounts,
                    totalSpend,
                    avgPrice,
                    starPlayer,
                    skillTotals,
                };
            }).filter(Boolean);
        }, [allSquads, squadIdsToCompare]);
    
        const findBestValueSquadIds = (metricKey, compareType = 'max') => {
            if (comparedSquads.length === 0) return new Set();
            
            const values = comparedSquads.map(s => {
                if (metricKey === 'avgPrice') return s.avgPrice > 0 ? s.avgPrice : Infinity;
                if (metricKey.startsWith('subSpace-')) return s.subSpaceCounts[metricKey.split('-')[1]];
                if (metricKey === 'players') return s.players.length;
                if (metricKey === 'starPlayer') return s.starPlayer?.soldPrice || 0;
                return s[metricKey];
            });
    
            const relevantValues = values.filter(v => v !== Infinity);
            if (relevantValues.length === 0) return new Set();
    
            const targetValue = compareType === 'max' ? Math.max(...relevantValues) : Math.min(...relevantValues);
            
            const bestSquadIds = new Set();
            comparedSquads.forEach((s, i) => {
                if (values[i] === targetValue) {
                    bestSquadIds.add(s.id);
                }
            });
            return bestSquadIds;
        };
    
        const metricGroups = [
            {
                title: 'Financials',
                metrics: [
                    { key: 'budget', label: 'Remaining Budget', description: 'Available funds for bidding.', icon: Icons.budget, type: 'currency', best: 'max' },
                    { key: 'totalSpend', label: 'Total Spend', description: 'Total amount spent on players.', icon: Icons.spend, type: 'currency', best: 'max' },
                    { key: 'avgPrice', label: 'Avg Price / Player', description: 'Average cost per player.', icon: Icons.avg, type: 'currency', best: 'min' },
                ]
            },
            {
                title: 'Roster Composition',
                metrics: [
                    { key: 'players', label: 'Total Players', description: 'Current squad size.', icon: Icons.roster, type: 'progress', best: 'max' },
                    { key: 'femaleCount', label: 'Female Players', description: 'Progress towards gender diversity.', icon: Icons.female, type: 'progress', best: 'max' },
                    // FIX: Use the typed `subSpaceKeys` array for iteration to prevent type errors. This was causing a type error due to relying on a closure variable. The fix uses the `subSpaceDisplayNames` prop directly to ensure correct type inference.
// FIX: Using `subSpaceKeys` from the closure to prevent errors with string interpolation. The previous implementation using `Object.keys` on an `any` prop caused the key to be inferred as `string | number | symbol`.
                    ...subSpaceKeys.map(key => ({
                        key: `subSpace-${key}`, label: `${subSpaceDisplayNames[key]}`, description: `Minimum required ${key} players.`, icon: Icons.subspace, type: 'progress', best: 'max'
                    })),
                ]
            },
            {
                title: 'Star Power',
                metrics: [
                    { key: 'starPlayer', label: 'Star Player', description: 'Most expensive player acquired.', icon: Icons.star, type: 'star', best: 'max' },
                ]
            }
        ];
    
        const maxSkillValue = Math.max(1, ...comparedSquads.flatMap(s => Object.values(s.skillTotals)));
    
        if (!isOpen) return null;
    
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content squad-comparison-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Squad Comparison</h3>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <div className="roster-table-container">
                        <table className="comparison-table">
                            <thead>
                                <tr>
                                    <th></th>
                                    {comparedSquads.map(s => (
                                        <th key={s.id} className="comparison-header">{s.name}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                <SkillProfile squads={comparedSquads} maxSkillValue={maxSkillValue} />
                                {metricGroups.map(group => (
                                    <React.Fragment key={group.title}>
                                        <tr className="comparison-section-header">
                                            <td colSpan={comparedSquads.length + 1}>{group.title}</td>
                                        </tr>
                                        {group.metrics.map(metric => {
                                            const bestSquads = findBestValueSquadIds(metric.key, metric.best);
                                            return (
                                                <tr key={metric.key} className="metric-row">
                                                    <td className="metric-label-cell">
                                                        <div className="metric-label-content">
                                                            <div className="metric-icon">{metric.icon}</div>
                                                            <div className="metric-info">
                                                                <span className="metric-label-title">{metric.label}</span>
                                                                <span className="metric-description">{metric.description}</span>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    {comparedSquads.map(s => {
                                                        const isBest = bestSquads.has(s.id);
                                                        let content;
                                                        switch (metric.type) {
                                                            case 'currency':
                                                                content = formatCurrency(s[metric.key]);
                                                                break;
                                                            case 'progress':
                                                                const value = metric.key === 'players' ? s.players.length : (metric.key === 'femaleCount' ? s.femaleCount : s.subSpaceCounts[metric.key.split('-')[1]]);
                                                                const max = metric.key === 'players' ? config.minSquadSize : (metric.key === 'femaleCount' ? config.minFemalePlayers : config.subSpaceRequirements[metric.key.split('-')[1]]);
                                                                content = <ComparisonProgressBar value={value} max={max} isBest={isBest} format={(v, isMax) => isMax ? max : v}/>;
                                                                break;
                                                             case 'star':
                                                                content = s.starPlayer ? (
                                                                    <div className="star-player-card">
                                                                        <span className="star-player-name">{s.starPlayer.name}</span>
                                                                        <span className="star-player-price">{formatCurrency(s.starPlayer.soldPrice)}</span>
                                                                    </div>
                                                                ) : <span className="no-data">-</span>;
                                                                break;
                                                            default:
                                                                content = s[metric.key];
                                                        }
    
                                                        return (
                                                            <td key={s.id} className={`metric-value-cell ${isBest ? 'best-in-metric' : ''}`}>
                                                                {isBest && <div className="best-badge" title="Best in Metric">{Icons.trophy}</div>}
                                                                {content}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}
                                    </React.Fragment>
                                ))}
                            </tbody>
                        </table>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const FUNNY_QUOTES = [
        "I'm not superstitious, but I am a little stitious.",
        "I told my computer I needed a break, and now it won’t stop sending me Kit-Kat ads.",
        "Why don't scientists trust atoms? Because they make up everything!",
        "I'm on a seafood diet. I see food, and I eat it.",
        "My wallet is like an onion. Opening it makes me cry.",
        "I'm not lazy, I'm on energy-saving mode.",
        "They say 'don't try this at home' so I'm coming over to your house to try it.",
        "I have the heart of a lion and a lifetime ban from the zoo.",
        "I’m not arguing, I’m just explaining why I’m right.",
        "If you can't remember my name, just say 'chocolate' and I'll turn around.",
        "I'm not a morning person. I'm not an evening person. I'm barely a person.",
        "I used to play piano by ear, but now I use my hands.",
        "I don't need a hairstylist, my pillow gives me a new hairstyle every morning.",
        "I'm not saying I'm a superhero, but no one has ever seen me and Batman in the same room.",
        "The only exercise I get is running out of money."
    ];

    const playerQuote = useMemo(() => {
        if (!currentPlayer?.id) return '';
        // Simple hash function to get a deterministic index
        const idString = String(currentPlayer.id);
        let hash = 0;
        for (let i = 0; i < idString.length; i++) {
            const char = idString.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash |= 0; // Convert to 32bit integer
        }
        const index = Math.abs(hash) % FUNNY_QUOTES.length;
        return FUNNY_QUOTES[index];
    }, [currentPlayer]);

    const forecastedPrice = useMemo(() => {
        if (!currentPlayer || !squads) return 0;

        // 1. Skill Score
        const totalSkillScore = Object.values(currentPlayer.options)
            .flat()
            .reduce((sum, skill) => sum + skill.score, 0);
        const skillValue = totalSkillScore * 2500; // Multiplier for skill value

        // 2. Historical Bids
        const soldPlayers = squads.flatMap(s => s.players);
        const averageSoldPrice = soldPlayers.length > 0
            ? soldPlayers.reduce((sum, p) => sum + (p.soldPrice || 0), 0) / soldPlayers.length
            : BASE_PRICE;

        // 3. Demand Calculation
        let demandScore = 0;
        const needySquads = squads.filter(squad => {
            const { femaleCount, subSpaceCounts } = getSquadStats(squad);
            const needsFemale = femaleCount < minFemalePlayers;
            const needsSubSpace = subSpaceCounts[currentPlayer.subSpace] < (subSpaceRequirements[currentPlayer.subSpace] || 0);
            
            // A squad is "needy" if it needs this player's profile and can afford at least the base price
            return (
                (currentPlayer.gender === 'Female' && needsFemale) ||
                needsSubSpace
            ) && squad.budget >= BASE_PRICE;
        });

        // Weigh demand by the budget of needy squads
        if (needySquads.length > 0) {
            const totalNeedyBudget = needySquads.reduce((sum, s) => sum + s.budget, 0);
            const totalInitialBudget = SQUAD_COUNT * INITIAL_BUDGET;
            demandScore = (totalNeedyBudget / totalInitialBudget) * needySquads.length;
        }

        const demandMultiplier = 1 + (demandScore * 0.2); // Cap the multiplier effect

        // 4. Combine factors
        let finalPrice = ((skillValue * 0.4) + (averageSoldPrice * 0.6)) * demandMultiplier;

        // Ensure price is at least BASE_PRICE and round it
        finalPrice = Math.max(finalPrice, BASE_PRICE);
        return Math.round(finalPrice / 10000) * 10000;

    }, [currentPlayer, squads, getSquadStats, BASE_PRICE, minFemalePlayers, subSpaceRequirements, INITIAL_BUDGET, SQUAD_COUNT]);
    
    const remainingStats = auctionStarted ? {
        total: players.length,
        female: players.filter(p => p.gender === 'Female').length,
        analytics: players.filter(p => p.subSpace === 'Analytics').length,
        tech: players.filter(p => p.subSpace === 'Tech' || p.subSpace === 'India DCE Technology').length,
        marketing: players.filter(p => p.subSpace === 'Marketing Services').length,
    } : null;
    
    const unsoldPlayersCardClasses = ['card', 'unsold-players-card'];
    if (searchResult?.status === 'unsold') {
        unsoldPlayersCardClasses.push('search-highlight');
    }
    if (isUnsoldCardCollapsed) {
        unsoldPlayersCardClasses.push('collapsed');
    }

    const addToast = (message: string, type: 'success' | 'error' | 'info' = 'info', duration = 4000) => {
        const id = Date.now();
        setToasts(prev => [...prev, { id, message, type, exiting: false }]);
        setTimeout(() => {
            setToasts(prev =>
                prev.map(toast => (toast.id === id ? { ...toast, exiting: true } : toast))
            );
        }, duration);
    };

    const handleToastExited = (id: number) => {
        setToasts(prev => prev.filter(toast => toast.id !== id));
    };


    // --- Trading Components ---
    const handleNominatePlayer = (basePrice) => {
        if (!nominationConfig) return;
        saveStateForUndo();
        setTradingPool(prev => [
            ...prev,
            {
                playerId: nominationConfig.player.id,
                sellingSquadId: nominationConfig.sellingSquadId,
                basePrice: basePrice
            }
        ]);
        addToast(`${nominationConfig.player.name} has been nominated.`, 'info');
        setNominationConfig(null);
        setLastExportTrigger(Date.now());
    };

    const handleMakeOffer = (requestingSquadId: number, owningSquad: Squad, player: Player, price: number) => {
        saveStateForUndo();
        const newOffer: TradeOffer = {
            id: `trade_${Date.now()}_${player.id}`,
            requestingSquadId: requestingSquadId,
            owningSquadId: owningSquad.id,
            playerId: player.id,
            playerName: player.name,
            playerAvatarName: player.name,
            status: 'pending',
            history: [{
                type: 'offer',
                squadId: requestingSquadId,
                price: price,
                timestamp: Date.now()
            }]
        };
        setTradeOffers(prev => [newOffer, ...prev]);
        addToast(`Offer sent for ${player.name} to ${owningSquad.name}.`, 'info');
        setOfferConfig(null);
        setLastExportTrigger(Date.now());
    };

    const handleOfferResponse = (offerId: string, response: 'accept' | 'reject') => {
        const offerToUpdate = tradeOffers.find(o => o.id === offerId);
        if (!offerToUpdate) return;
    
        setIsNegotiationTimerRunning(false); // Stop the timer
    
        if (response === 'accept') {
            const price = offerToUpdate.history[offerToUpdate.history.length - 1].price;
            const requestingSquad = squads.find(s => s.id === offerToUpdate.requestingSquadId);
            
            if (requestingSquad && requestingSquad.budget < price) {
                setError("Trade could not be completed. Insufficient funds.");
                setTimeout(() => setError(''), 4000);
                setIsNegotiationTimerRunning(true); // resume timer
                return;
            }
            setNegotiationAnimationState({ type: 'accepted', offer: offerToUpdate, price });
        } else { // reject
            setNegotiationAnimationState({ type: 'rejected', offer: offerToUpdate });
        }
    };
    
    const handleCounterOffer = (offerId: string, counterPrice: number) => {
        const offerToUpdate = tradeOffers.find(o => o.id === offerId);
        if (!offerToUpdate) return;
    
        setIsNegotiationTimerRunning(false);
        setCounterOfferConfig(null); // Close the modal
        setNegotiationAnimationState({ type: 'countered', offer: offerToUpdate, price: counterPrice });
    };

    const handleNegotiationAnimationEnd = () => {
        if (!negotiationAnimationState) return;
        const { type, offer, price } = negotiationAnimationState;
    
        saveStateForUndo();
    
        if (type === 'accepted') {
            const requestingSquad = squads.find(s => s.id === offer.requestingSquadId);
            const owningSquad = squads.find(s => s.id === offer.owningSquadId);
    
            if (requestingSquad && owningSquad) {
                const playerIndex = owningSquad.players.findIndex(p => p.id === offer.playerId);
                
                if (playerIndex > -1 && requestingSquad.budget >= price) {
                    const updatedSquads = JSON.parse(JSON.stringify(squads));
                    const reqSquad = updatedSquads.find(s => s.id === requestingSquad.id);
                    const ownSquad = updatedSquads.find(s => s.id === owningSquad.id);
                    const [player] = ownSquad.players.splice(playerIndex, 1);
                    
                    const tradedPlayer = { ...player, soldPrice: price, boughtFrom: `Trade: ${owningSquad.name}` };
                    
                    reqSquad.players.push(tradedPlayer);
                    reqSquad.budget -= price;
                    ownSquad.budget += price;
                    setSquads(updatedSquads);
    
                    setTradeOffers(prevOffers =>
                        prevOffers.map(o => {
                            if (o.id === offer.id) return { ...o, status: 'accepted' };
                            if (o.playerId === offer.playerId && (o.status === 'pending' || o.status === 'countered')) {
                                return { ...o, status: 'rejected' };
                            }
                            return o;
                        })
                    );
                    setLastExportTrigger(Date.now());
                }
            }
        } else if (type === 'rejected') {
            setTradeOffers(prevOffers =>
                prevOffers.map(o => o.id === offer.id ? { ...o, status: 'rejected' } : o)
            );
            setLastExportTrigger(Date.now());
        } else if (type === 'countered') {
            setTradeOffers(prev => prev.map(o => {
                if (o.id === offer.id) {
                    const owningSquad = squads.find(s => s.id === o.owningSquadId);
                    if (!owningSquad) return o;
    
                    return {
                        ...o,
                        status: 'countered',
                        history: [
                            ...o.history,
                            { type: 'counter', squadId: owningSquad.id, price: price, timestamp: Date.now() }
                        ]
                    };
                }
                return o;
            }));
        }
    
        setNegotiationAnimationState(null);
        // Reset timer
        setNegotiationTimerValue(settings.negotiationDuration);
        setNegotiationTimerKey(k => k + 1);
        setIsNegotiationTimerRunning(true);
    };

    const MakeOfferModal = ({ isOpen, onClose, onConfirm, player, owningSquad, allSquads }) => {
        const [requestingSquadId, setRequestingSquadId] = useState('');
        const [offerPrice, setOfferPrice] = useState(player.soldPrice || 10000);
        const [validationError, setValidationError] = useState('');
    
        useEffect(() => {
            if (isOpen) {
                setRequestingSquadId('');
                setOfferPrice(player.soldPrice || 10000);
                setValidationError('');
            }
        }, [isOpen, player]);
    
        const handleConfirm = () => {
            if (!requestingSquadId) {
                setValidationError('Please select a squad to make the offer.');
                return;
            }
            const requestingSquad = allSquads.find(s => s.id === parseInt(requestingSquadId, 10));
            if (!requestingSquad) {
                setValidationError('Selected squad not found.');
                return;
            }
            if (requestingSquad.budget < offerPrice) {
                setValidationError('The offering squad does not have enough budget for this offer.');
                return;
            }
            if (offerPrice < 10000) {
                setValidationError('Offer price must be at least $10,000.');
                return;
            }
            onConfirm(parseInt(requestingSquadId, 10), owningSquad, player, offerPrice);
        };
        
        if (!isOpen) return null;
    
        const availableSquads = allSquads.filter(s => s.id !== owningSquad.id);
    
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Make Offer for {player.name}</h3>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <p>You are making an offer to acquire <strong>{player.name}</strong> from <strong>{owningSquad.name}</strong>.</p>
                        {player.soldPrice > 0 && (
                            <div className="offer-context-price">
                                Last Sold Price: <strong>{formatCurrency(player.soldPrice)}</strong>
                            </div>
                        )}
                        <div className="form-group">
                            <label htmlFor="requesting-squad">Offering Squad</label>
                            <select id="requesting-squad" value={requestingSquadId} onChange={e => setRequestingSquadId(e.target.value)}>
                                <option value="" disabled>Select a squad...</option>
                                {availableSquads.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.name} (Budget: {formatCurrency(s.budget)})
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="offer-price">Offer Price</label>
                            <input
                                type="number"
                                id="offer-price"
                                className="price-input"
                                value={offerPrice}
                                min="10000"
                                step="10000"
                                onChange={e => setOfferPrice(parseInt(e.target.value, 10) || 0)}
                            />
                        </div>
                        {validationError && <p className="summary-validation-error" style={{marginTop: '1rem'}}>{validationError}</p>}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleConfirm} disabled={!requestingSquadId}>Submit Offer</button>
                    </div>
                </div>
            </div>
        );
    };

    const NominationModal = () => {
        const [basePrice, setBasePrice] = useState(10000);
        const inputRef = useRef<HTMLInputElement>(null);
    
        useEffect(() => {
            if (nominationConfig) {
                setBasePrice(nominationConfig.player.soldPrice || 10000);
                setTimeout(() => inputRef.current?.focus(), 0);
            }
        }, [nominationConfig]);
    
        if (!nominationConfig) return null;

        const handleConfirm = () => {
            if (basePrice >= 10000) {
                handleNominatePlayer(basePrice);
                resumeTimerAfterModal();
            } else {
                setError("Base price must be at least $10,000.");
                setTimeout(() => setError(''), 3000);
            }
        };

        const handleCancel = () => {
            setNominationConfig(null);
            resumeTimerAfterModal();
        };
    
        return (
            <div className="modal-overlay" onClick={handleCancel}>
                <div className="modal-content nomination-modal" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Nominate Player</h3>
                        <button className="close-button" onClick={handleCancel}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <p>Set the starting base price for <strong>{nominationConfig.player.name}</strong> in the trade auction.</p>
                        <div className="nomination-form">
                            <label htmlFor="basePrice">Base Price</label>
                            <input
                                ref={inputRef}
                                type="number"
                                id="basePrice"
                                className="price-input"
                                value={basePrice}
                                min="10000"
                                step="10000"
                                onChange={e => setBasePrice(parseInt(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={handleCancel}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleConfirm}>Add to Trading Block</button>
                    </div>
                </div>
            </div>
        );
    };
    
    const CounterOfferModal = ({ isOpen, onClose, onConfirm, offer }) => {
        if (!isOpen || !offer) return null;

        const lastOffer = offer.history[offer.history.length - 1];
        const offeringSquad = squads.find(s => s.id === lastOffer.squadId);

        const [counterPrice, setCounterPrice] = useState(0);
        const [validationError, setValidationError] = useState('');

        useEffect(() => {
            if (lastOffer) {
                setCounterPrice(calculateNextBid(lastOffer.price));
                setValidationError('');
            }
        }, [lastOffer]);

        const handleConfirm = () => {
            if (counterPrice <= lastOffer.price) {
                setValidationError(`Counter price must be higher than the current offer of ${formatCurrency(lastOffer.price)}.`);
                return;
            }
            onConfirm(offer.id, counterPrice);
        };

        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <div className="modal-header">
                        <h3>Counter Offer for {offer.playerName}</h3>
                        <button className="close-button" onClick={onClose}>&times;</button>
                    </div>
                    <div className="modal-body">
                        <p>You are making a counter-offer to <strong>{offeringSquad?.name}</strong>.</p>
                        <div className="offer-context-price">
                            Current Offer: <strong>{formatCurrency(lastOffer.price)}</strong>
                        </div>
                        <div className="form-group">
                            <label htmlFor="counter-price">Your Counter Price</label>
                            <input
                                type="number"
                                id="counter-price"
                                className="price-input"
                                value={counterPrice}
                                min={lastOffer.price + 1}
                                step="10000"
                                onChange={e => {
                                    setCounterPrice(parseInt(e.target.value, 10) || 0);
                                    setValidationError('');
                                }}
                            />
                        </div>
                        {validationError && <p className="summary-validation-error" style={{marginTop: '1rem'}}>{validationError}</p>}
                    </div>
                    <div className="modal-footer">
                        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                        <button className="btn btn-primary" onClick={handleConfirm}>Submit Counter</button>
                    </div>
                </div>
            </div>
        );
    };

    const TradingBlock = () => {
        const [expandedSquads, setExpandedSquads] = useState<number[]>([]);
        
        const pendingIndividualOffers = useMemo(() =>
            tradeOffers.filter(o => o.status === 'pending' || o.status === 'countered')
        , [tradeOffers]);


        const handleToggleSquad = (squadId: number) => {
            setExpandedSquads(prev => prev.includes(squadId) ? prev.filter(id => id !== squadId) : [...prev, squadId]);
        };

        const handleRemoveFromPool = (playerId) => {
            saveStateForUndo();
            setTradingPool(prev => prev.filter(p => p.playerId !== playerId));
        };
        
        const handleStartTradeAuction = () => {
            if (tradingPool.length > 0) {
                saveStateForUndo();
                setTradeAuctionState({ status: 'active', currentPlayerIndex: -1 });
                selectNextTradePlayer();
            }
        };

        const handleStartNegotiations = () => {
            if (playersWithPendingOffers.length > 0) {
                saveStateForUndo();
                setTradeNegotiationState({ status: 'negotiating', currentPlayerIndex: 0 });
            }
        };

        const handleFinalizeAndNext = (playerId) => {
            saveStateForUndo();
            // Reject all PENDING or COUNTERED offers for this player
            setTradeOffers(prevOffers =>
                prevOffers.map(offer =>
                    (String(offer.playerId).trim() === String(playerId).trim() && (offer.status === 'pending' || offer.status === 'countered'))
                        ? { ...offer, status: 'rejected' }
                        : offer
                )
            );
            setLastExportTrigger(Date.now());
        };

        useEffect(() => {
            if (tradeNegotiationState.status === 'negotiating') {
                if (tradeNegotiationState.currentPlayerIndex >= playersWithPendingOffers.length) {
                    if (playersWithPendingOffers.length > 0) {
                        setTradeNegotiationState(prev => ({...prev, currentPlayerIndex: playersWithPendingOffers.length - 1 }));
                    } else {
                        setTradeNegotiationState({ status: 'finished', currentPlayerIndex: -1 });
                    }
                } else {
                    // When player changes, reset selected offer to the first available one.
                    const currentNegotiation = playersWithPendingOffers[tradeNegotiationState.currentPlayerIndex];
                     if (currentNegotiation) {
                         const offersForThisPlayer = tradeOffers.filter(o => String(o.playerId).trim() === String(currentNegotiation.playerId).trim() && (o.status === 'pending' || o.status === 'countered'));
                         if(offersForThisPlayer.length > 0) {
                            setSelectedOfferId(offersForThisPlayer[0].id);
                         } else {
                            // If no more pending offers, move to next player.
                            handleFinalizeAndNext(currentNegotiation.playerId);
                         }
                    }
                }
            }
        }, [playersWithPendingOffers, tradeNegotiationState.status, tradeNegotiationState.currentPlayerIndex]);


        if (tradeAuctionState.status === 'finished') {
            return (
                <div className="card trade-finished-card">
                    <h2>Trade Auction Finished</h2>
                    <p>All nominated players have been auctioned.</p>
                    <button className="btn btn-primary" onClick={() => {
                        setTradingPool([]);
                        setTradeAuctionState({ status: 'nominating', currentPlayerIndex: -1 });
                    }}>
                        Start New Trading Round
                    </button>
                </div>
            )
        }
        
        if (tradeAuctionState.status === 'active') {
            return (
                 <div className="squads-dashboard">
                    <div className="top-dashboard-layout">
                        <div className="current-player-area">
                            {auctionStarted && currentPlayer && (
                                <>
                                    {/* FIX: Add missing negotiation timer props to CurrentPlayerCard to satisfy its signature. These are not used in this context. */}
                                    <CurrentPlayerCard
                                        isTradeAuction={true}
                                        sellingSquadId={currentSellingSquadId}
                                        negotiationOffer={null}
                                        isCompactNegotiationView={false}
                                        negotiationTimerValue={0}
                                        isNegotiationTimerRunning={false}
                                        negotiationTimerKey={0}
                                        negotiationTimerDuration={0}
// FIX: Added missing onToggleNegotiationTimer prop to satisfy the component's signature. A no-op is safe here as this timer is not active in this context.
                                        onToggleNegotiationTimer={() => {}}
                                    />
                                    <div className="card current-player-actions-card">
                                        <div className="auction-controls">
                                            <button className="btn btn-success" onClick={sellPlayer} disabled={!highestBidder}>Sell Player</button>
                                            <button className="btn btn-secondary" onClick={moveToNextPlayer}>Pass (Unsold)</button>
                                            <button className="btn btn-secondary" onClick={handleUndo} disabled={history.length === 0}>Undo</button>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    <SquadCardsContainer isTradeAuction={true} sellingSquadId={currentSellingSquadId} negotiationOffer={null} onOfferResponse={handleOfferResponse} onCounterOffer={setCounterOfferConfig} />
                </div>
            );
        }
        
        // --- Negotiation Phase UI ---
        if (tradeNegotiationState.status === 'negotiating') {
            const currentNegotiation = playersWithPendingOffers[tradeNegotiationState.currentPlayerIndex];

            if (!currentNegotiation) {
                return (
                     <div className="card trade-finished-card">
                        <h2>Trade Negotiations Finished</h2>
                        <p>All pending offers have been addressed.</p>
                        <button className="btn btn-primary" onClick={() => setTradeNegotiationState({ status: 'collecting', currentPlayerIndex: -1 })}>
                            Start New Offer Round
                        </button>
                    </div>
                )
            }

            const { player, owningSquad } = currentNegotiation;
            const offersForThisPlayer = tradeOffers.filter(o => String(o.playerId).trim() === String(player.id).trim() && (o.status === 'pending' || o.status === 'countered'));
            const selectedOffer = tradeOffers.find(o => o.id === selectedOfferId);
            const lastHistoryItem = selectedOffer?.history[selectedOffer.history.length - 1];
            const isCounterOffer = lastHistoryItem?.type === 'counter';

            return (
                <div className="squads-dashboard">
                    <div className="top-dashboard-layout">
                        <div className="current-player-area">
                            {player && selectedOffer ? (
                                <div className="negotiation-arena-layout">
                                    <CurrentPlayerCard
                                        isTradeAuction={false}
                                        sellingSquadId={null}
                                        negotiationOffer={selectedOffer}
                                        isCompactNegotiationView={false}
                                        negotiationTimerValue={negotiationTimerValue}
                                        isNegotiationTimerRunning={isNegotiationTimerRunning}
                                        negotiationTimerKey={negotiationTimerKey}
                                        negotiationTimerDuration={settings.negotiationDuration}
                                        onToggleNegotiationTimer={() => setIsNegotiationTimerRunning(prev => !prev)}
                                    />
                                    <div className="negotiation-actions-column">
                                        <div className="card negotiation-offer-selector-card">
                                            <h4>Incoming Offers ({offersForThisPlayer.length})</h4>
                                            <div className="offer-list">
                                                {offersForThisPlayer.map(offer => {
                                                    const reqSquad = squads.find(s => s.id === offer.requestingSquadId);
                                                    const lastItem = offer.history[offer.history.length - 1];
                                                    return (
                                                        <button
                                                            key={offer.id}
                                                            className={`offer-list-item ${offer.id === selectedOffer?.id ? 'active' : ''}`}
                                                            onClick={() => setSelectedOfferId(offer.id)}>
                                                            <span>From: {reqSquad?.name || '...'} {lastItem.type === 'counter' ? '(C)' : ''}</span>
                                                            <span className="offer-price">{formatCurrency(lastItem.price)}</span>
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        <div className="card current-player-actions-card">
                                            <div className="auction-controls">
                                                <button
                                                    className="btn btn-success"
                                                    onClick={() => handleOfferResponse(selectedOffer.id, 'accept')}
                                                    disabled={!selectedOffer}
                                                >
                                                    {isCounterOffer ? 'Accept Counter' : 'Accept Offer'}
                                                </button>
                                                <button
                                                    className="btn btn-danger"
                                                    onClick={() => handleOfferResponse(selectedOffer.id, 'reject')}
                                                    disabled={!selectedOffer}
                                                >
                                                    {isCounterOffer ? 'Reject Counter' : 'Reject Offer'}
                                                </button>
                                                <button
                                                    className="btn btn-secondary"
                                                    onClick={handleUndo}
                                                    disabled={history.length === 0}
                                                >
                                                    Undo Last Action
                                                </button>
                                            </div>
                                            <div className="negotiation-footer">
                                                <button className="btn btn-secondary" onClick={() => handleFinalizeAndNext(player.id)}>
                                                    Reject Remaining & Next Player
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="card">
                                    <p className="no-players-placeholder">All offers for this player have been resolved. Please start a new negotiation round.</p>
                                </div>
                            )}
                        </div>
                    </div>
                    <SquadCardsContainer isTradeAuction={false} sellingSquadId={null} negotiationOffer={selectedOffer} onOfferResponse={handleOfferResponse} onCounterOffer={handleCounterOffer} />
                </div>
            );
        }
        
        if (tradeNegotiationState.status === 'finished') {
             return (
                 <div className="card trade-finished-card">
                    <h2>Trade Negotiations Finished</h2>
                    <p>All pending offers have been addressed.</p>
                    <button className="btn btn-primary" onClick={() => {
                        setTradeNegotiationState({ status: 'collecting', currentPlayerIndex: -1 });
                        setTradeOffers(prev => prev.filter(o => o.status === 'pending' || o.status === 'countered'));
                    }}>
                        Start New Offer Round
                    </button>
                </div>
            )
        }


        // --- Offer Collection Phase UI ---
        return (
            <div className="trading-block-container">
                <div className="trading-block-header">
                    <h2>The Trading Floor</h2>
                    <div className="trading-header-actions">
                        <button className="btn btn-secondary" onClick={handleStartTradeAuction} disabled={tradingPool.length === 0}>
                            Start Nomination Auction ({tradingPool.length})
                        </button>
                        <button className="btn btn-primary" onClick={handleStartNegotiations} disabled={playersWithPendingOffers.length === 0}>
                            Start Negotiations ({playersWithPendingOffers.length} Players)
                        </button>
                    </div>
                </div>

                <div className="nomination-layout">
                    <div className="trading-left-column">
                        <div className="trade-offers-section">
                            <h3>Incoming Trade Offers</h3>
                            <div className="trading-pool-list">
                                {pendingIndividualOffers.length === 0 ? (
                                    <p className="no-players-placeholder">No pending direct offers.</p>
                                ) : (
                                    pendingIndividualOffers.map(offer => {
                                        const lastHistoryItem = offer.history[offer.history.length - 1];
                                        const requestingSquad = squads.find(s => s.id === offer.requestingSquadId);
                                        const lastActingSquad = squads.find(s => s.id === lastHistoryItem.squadId);
                                        
                                        return (
                                            <div key={offer.id} className="trading-pool-item">
                                                <div className="trading-pool-item-info">
                                                    <span className="player-name">{offer.playerName}</span>
                                                    <span className="squad-name">
                                                        {lastHistoryItem.type === 'counter'
                                                            ? `Counter from ${lastActingSquad?.name}`
                                                            : `Offer from ${requestingSquad?.name}`
                                                        }
                                                    </span>
                                                    <span className="base-price">
                                                        {lastHistoryItem.type === 'counter' ? 'Counter: ' : 'Offer: '}
                                                        {formatCurrency(lastHistoryItem.price)}
                                                    </span>
                                                </div>
                                                <button className="btn btn-danger btn-remove-trade" onClick={() => handleOfferResponse(offer.id, 'reject')}>&times;</button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                        <div className="trading-pool-column">
                            <h3>Nomination Block</h3>
                            <div className="trading-pool-list">
                                {tradingPool.length === 0 ? (
                                    <p className="no-players-placeholder">No players nominated for auction.</p>
                                ) : (
                                    tradingPool.map(item => {
                                        const player = getPlayerFromPool(item.playerId);
                                        const squad = squads.find(s => s.id === item.sellingSquadId);
                                        if (!player || !squad) return null;
                                        return (
                                            <div key={player.id} className="trading-pool-item">
                                                <div className="trading-pool-item-info">
                                                    <span className="player-name">{player.name}</span>
                                                    <span className="squad-name">from {squad.name}</span>
                                                    <span className="base-price">Base: {formatCurrency(item.basePrice)}</span>
                                                </div>
                                                <button className="btn btn-danger btn-remove-trade" onClick={() => handleRemoveFromPool(player.id)}>&times;</button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="squad-rosters-column">
                        <h3>Squad Rosters</h3>
                        <p className="instructions">Nominate players for auction or make a direct trade offer.</p>
                        <div className="squad-rosters-list">
                            {squads.map(squad => (
                                <div key={squad.id} className="squad-roster-card">
                                    <button className="squad-roster-header" onClick={() => handleToggleSquad(squad.id)}>
                                        <span>{squad.name} ({squad.players.length} players)</span>
                                        <svg className={`chevron ${expandedSquads.includes(squad.id) ? 'expanded' : ''}`} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                                    </button>
                                    {expandedSquads.includes(squad.id) && (
                                        <div className="squad-player-list-trade">
                                            {squad.players.length > 0 ? squad.players.sort((a,b) => a.name.localeCompare(b.name)).map(player => {
                                                const isOnBlock = tradingPool.some(p => p.playerId === player.id);
                                                
                                                const { femaleCount, subSpaceCounts } = getSquadStats(squad);
                                                let nominationDisabledReason = '';

                                                if (squad.players.length <= minSquadSize) {
                                                    nominationDisabledReason = `Cannot nominate: Roster must be above minimum size (${minSquadSize}).`;
                                                } else if (player.gender === 'Female' && femaleCount <= minFemalePlayers) {
                                                    nominationDisabledReason = `Cannot nominate: Must maintain minimum female players (${minFemalePlayers}).`;
                                                } else {
                                                    const subSpaceCategory =
                                                        player.subSpace === 'Analytics' ? 'Analytics' :
                                                        (player.subSpace === 'Tech' || player.subSpace === 'India DCE Technology') ? 'Tech' :
                                                        player.subSpace === 'Marketing Services' ? 'Marketing' :
                                                        null;

                                                    if (subSpaceCategory) {
                                                        const requirement = subSpaceRequirements[subSpaceCategory];
                                                        const currentCount = subSpaceCounts[subSpaceCategory];
                                                        if (requirement > 0 && currentCount <= requirement) {
                                                            nominationDisabledReason = `Cannot nominate: Must maintain minimum ${subSpaceDisplayNames[subSpaceCategory]} players (${requirement}).`;
                                                        }
                                                    }
                                                }
                                                const isNominationDisabled = !!nominationDisabledReason;

                                                return (
                                                    <div key={player.id} className="squad-player-item-trade">
                                                        <div className="player-info">
                                                            <span>{player.name}</span>
                                                            <span className="price">Last Sold: {formatCurrency(player.soldPrice)}</span>
                                                        </div>
                                                        <div className="trade-actions">
                                                            <button className="btn btn-secondary btn-small" onClick={() => { pauseTimerForModal(); setOfferConfig({ player, owningSquad: squad }); }}>
                                                                Make Offer
                                                            </button>
                                                            <div className="tooltip-container" data-tooltip={nominationDisabledReason}>
                                                                <button 
                                                                    className="btn btn-secondary btn-small"
                                                                    onClick={() => { pauseTimerForModal(); setNominationConfig({ player, sellingSquadId: squad.id }); }}
                                                                    disabled={isOnBlock || isNominationDisabled}
                                                                >
                                                                    {isOnBlock ? 'On Block' : 'Nominate'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }) : <p className="no-players-placeholder">No players in this squad.</p>}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const CurrentPlayerCard = ({ 
        isTradeAuction, 
        sellingSquadId, 
        negotiationOffer, 
        isCompactNegotiationView,
        negotiationTimerValue,
        isNegotiationTimerRunning,
        negotiationTimerKey,
        negotiationTimerDuration,
        onToggleNegotiationTimer
    }) => {
        const playerForCard = negotiationOffer ? getPlayerFromPool(negotiationOffer.playerId) : currentPlayer;
        if (!playerForCard) return null;

        const cardClasses = ['card', 'current-player-card'];
        if (searchResult?.status === 'current') {
            cardClasses.push('search-highlight');
        }

        const isMainTimerPulsing = !negotiationOffer && isTimerRunning && timerValue <= 5;
        const isNegoTimerPulsing = negotiationOffer && isNegotiationTimerRunning && negotiationTimerValue <= 5;

        if (isMainTimerPulsing || isNegoTimerPulsing) {
            cardClasses.push('pulsing-card');
        }
        
        const allPlayerCardSkills = useMemo(() => {
            if (!playerForCard) return [];
            // FIX: Add a type assertion to `skills` to resolve TypeScript's inability to infer it as an array from `Object.entries`.
            return Object.entries(playerForCard.options).flatMap(([category, skills]) => 
                (skills as Skill[]).map(skill => ({ ...skill, category }))
            );
        }, [playerForCard]);

        const sellingSquadName = isTradeAuction ? squads.find(s => s.id === sellingSquadId)?.name : null;
        
        // Negotiation specific data
        const lastHistoryItem = negotiationOffer?.history[negotiationOffer.history.length - 1];
        const offeringSquad = negotiationOffer ? squads.find(s => s.id === lastHistoryItem.squadId) : null;
        const offerPrice = negotiationOffer ? lastHistoryItem.price : null;
        const isCounter = negotiationOffer ? lastHistoryItem.type === 'counter' : false;
        const isBasePriceEditable = !highestBidder && !negotiationOffer;
        
        return (
            <div className={cardClasses.join(' ')}>
                {isTradeAuction && sellingSquadName && (
                     <div className="trade-auction-banner">
                         Trading Player from <strong>{sellingSquadName}</strong>
                     </div>
                )}
                 {negotiationOffer && (
                     <div className="trade-auction-banner" style={{backgroundColor: 'var(--primary-accent)'}}>
                         Negotiating for Player from <strong>{squads.find(s=>s.id === negotiationOffer.owningSquadId)?.name}</strong>
                     </div>
                )}
                <div className={`player-card-layout ${isCompactNegotiationView ? 'compact-negotiation' : ''}`}>
                    <div className="player-photo-column">
                        {!isCompactNegotiationView && (
                            <>
                                <Avatar name={playerForCard.name} />
                                <h3 className={isTimerRunning && timerValue <= 5 ? 'pulsing' : ''}>
                                    {playerForCard.name}
                                </h3>
                            </>
                        )}
                        {playerForCard.soldPrice > 0 && (
                            <div className="last-sold-price" data-tooltip="The price this player was acquired for in the main auction.">
                                <span>Acquired For:</span> {formatCurrency(playerForCard.soldPrice)}
                            </div>
                        )}
                        {!negotiationOffer && !isTradeAuction && (
                            <div className="forecasted-price" data-tooltip="An estimated market value based on skills, demand, and auction history.">
                                <span>Forecast:</span> {formatCurrency(forecastedPrice)}
                            </div>
                        )}
                    </div>
                    <div className="player-details-column">
                        <div className="player-card-header">
                            <div className="bidding-info">
                                <div className="bid-details">
                                    <p className="highest-bidder-info">
                                        {negotiationOffer 
                                            ? (isCounter ? `Counter from ${offeringSquad?.name}`: `Offer from ${offeringSquad?.name}`)
                                            : (highestBidder ? `Highest: ${squads.find(s => s.id === highestBidder)?.name || `Squad ${highestBidder}`}` : 'Awaiting Bids')
                                        }
                                    </p>
                                    <p className="suggested-bid">
                                        {negotiationOffer
                                            ? `Value: ${formatCurrency(offerPrice)}`
                                            : isBasePriceEditable
                                                ? 'Starting Bid'
                                                : `Next Bid: ${formatCurrency(nextBidAmount)}`
                                        }
                                    </p>
                                </div>
                                {negotiationOffer ? (
                                    <>
                                        <div className={`timer-container ${!isNegotiationTimerRunning ? 'paused' : ''}`}>
                                            <TimerDisplay duration={negotiationTimerDuration} value={negotiationTimerValue} key={negotiationTimerKey} />
                                            <button onClick={onToggleNegotiationTimer} className="btn-icon" title={isNegotiationTimerRunning ? "Pause Timer" : "Resume Timer"}>
                                                {isNegotiationTimerRunning 
                                                    ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                }
                                            </button>
                                        </div>
                                        <p className="current-bid">{formatCurrency(offerPrice)}</p>
                                    </>
                                ) : (
                                    <>
                                        <div className={`timer-container ${!isTimerRunning ? 'paused' : ''}`}>
                                            <TimerDisplay duration={timerDuration} value={timerValue} key={timerKey} />
                                            <button onClick={() => setIsTimerRunning(prev => !prev)} className="btn-icon" title={isTimerRunning ? "Pause Timer" : "Resume Timer"}>
                                                {isTimerRunning 
                                                    ? <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                                                    : <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                }
                                            </button>
                                        </div>
                                        {isBasePriceEditable ? (
                                            <div className="base-price-editor">
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handlePriceStepChange('decrease')}
                                                    aria-label="Decrease starting bid by 10,000"
                                                    title="Decrease by 10K"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13H5v-2h14v2z"/></svg>
                                                </button>
                                                <input
                                                    type="number"
                                                    className="current-bid base-price-input"
                                                    value={currentBid}
                                                    onChange={(e) => handleBasePriceChange(e.target.value)}
                                                    min="10000"
                                                    step="10000"
                                                    aria-label="Set starting bid price"
                                                />
                                                <button
                                                    className="btn-icon"
                                                    onClick={() => handlePriceStepChange('increase')}
                                                    aria-label="Increase starting bid by 10,000"
                                                    title="Increase by 10K"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="current-bid">{formatCurrency(currentBid)}</p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                        <div className="player-card-content-grid">
                            <div className="player-primary-info">
                                <div className="player-card-details">
                                    <div className="player-stat-item" data-tooltip="Employee's unique identifier.">
                                        {PlayerStatIcons.id}
                                        <span><strong>ID:</strong> {playerForCard.empId || 'N/A'}</span>
                                    </div>
                                    <div className="player-stat-item" data-tooltip="Player's registered gender.">
                                        {PlayerStatIcons.gender}
                                        <span><strong>Gender:</strong> {playerForCard.gender}</span>
                                    </div>
                                    <div className="player-stat-item" data-tooltip="Player's office location.">
                                        {PlayerStatIcons.location}
                                        <span><strong>Location:</strong> {playerForCard.location}</span>
                                    </div>
                                    <div className="player-stat-item" data-tooltip="Player's assigned sub-space or department.">
                                        {PlayerStatIcons.subspace}
                                        <span><strong>Sub-Space:</strong> {playerForCard.subSpace}</span>
                                    </div>
                                    <div className="player-stat-item wide" data-tooltip="Player's email address.">
                                        {PlayerStatIcons.email}
                                        <span><strong>Email:</strong> {playerForCard.email}</span>
                                    </div>
                                </div>
                                {playerQuote && (
                                    <div className="player-quote">
                                        <p>"{playerQuote}"</p>
                                    </div>
                                )}
                            </div>
                            <div className="player-skills-section compact">
                                <h4>Skills</h4>
                                <div className="skills-grid">
                                    {allPlayerCardSkills.map(skill => (
                                        <div key={skill.name} className={`skill-tag ${skill.category}`} title={`${skill.name} - ${skill.score}/10`}>
                                            <div className="skill-tag-icon">{SkillIcons[skill.category]}</div>
                                            <span className="skill-tag-name">{skill.name}</span>
                                            <div className="skill-tag-bar-container">
                                                <div className="skill-tag-bar" style={{ width: `${skill.score * 10}%` }}></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const SquadCardsContainer = ({ isTradeAuction, sellingSquadId, negotiationOffer, onOfferResponse, onCounterOffer }) => {
        return (
            <div className="squad-cards-container">
                {squads.map(s => {
                    const { femaleCount, subSpaceCounts } = getSquadStats(s);
                    const isMinSizeMet = s.players.length >= minSquadSize;
                    const isFemaleMet = femaleCount >= minFemalePlayers;
                    const areSubSpacesMet = Object.keys(subSpaceRequirements).every(
                        key => subSpaceCounts[key] >= subSpaceRequirements[key]
                    );
                    const isDanger = auctionStarted && (
                        s.budget < BASE_PRICE && s.players.length < minSquadSize
                    );
                    const hasPreAuctionWarning = !auctionStarted && preAuctionWarnings.includes(s.id);
                    const isSelectedForCompare = squadsToCompare.includes(s.id);

                    const isNegotiation = !!negotiationOffer;
                    let negotiationAction = null;
                    if (isNegotiation) {
                        const lastHistory = negotiationOffer.history[negotiationOffer.history.length - 1];
                        const isOwnerTurn = lastHistory.type === 'offer';
                        const isRequesterTurn = lastHistory.type === 'counter';

                        if (isOwnerTurn && s.id === negotiationOffer.owningSquadId) {
                            negotiationAction = {
                                text: 'Counter',
                                action: () => { pauseTimerForModal(); setCounterOfferConfig({ offer: negotiationOffer }); },
                                disabled: false,
                                className: 'btn-warning'
                            };
                        } else if (isRequesterTurn && s.id === negotiationOffer.requestingSquadId) {
                            negotiationAction = {
                                text: 'Accept Counter',
                                action: () => onOfferResponse(negotiationOffer.id, 'accept'),
                                disabled: false,
                                className: 'btn-success'
                            };
                        }
                    }


                    const squadCardClasses = ['card', 'squad-card'];
                    if (!isNegotiation && s.id === highestBidder) squadCardClasses.push('highest-bidder');
                    if (isDanger) squadCardClasses.push('squad-danger');
                    if (hasPreAuctionWarning) squadCardClasses.push('squad-warning');
                    if (searchResult?.status === 'sold' && searchResult.squadId === s.id) {
                        squadCardClasses.push('search-highlight');
                    }
                    if (isSelectedForCompare) squadCardClasses.push('selected-for-compare');
                    if (isNegotiation && s.id === negotiationOffer.owningSquadId) squadCardClasses.push('squad-warning');
                    if (isNegotiation && s.id === negotiationOffer.requestingSquadId) squadCardClasses.push('highest-bidder');
                    
                    const disabledReason = isNegotiation ? null : getBidDisabledReason(s, nextBidAmount);

                    return (
                        <div key={s.id} className={squadCardClasses.join(' ')}>
                            <div className="squad-header">
                                <div className="squad-header-left">
                                    <input
                                        type="checkbox"
                                        className="squad-card-compare-toggle"
                                        title="Select squad for comparison"
                                        checked={isSelectedForCompare}
                                        onChange={() => handleToggleCompare(s.id)}
                                        disabled={!isSelectedForCompare && squadsToCompare.length >= 5}
                                    />
                                    <h4>{s.name}</h4>
                                </div>
                                <span className="squad-budget">{formatCurrency(s.budget)}</span>
                            </div>
                            <div className="budget-progress-bar" data-tooltip={`Budget: ${formatCurrency(s.budget)} / ${formatCurrency(INITIAL_BUDGET)}`}>
                                <div 
                                    className="budget-progress" 
                                    style={{ 
                                        width: `${(s.budget / INITIAL_BUDGET) * 100}%`,
                                        backgroundColor: s.budget > INITIAL_BUDGET * 0.5 ? 'var(--success-color)' : s.budget > INITIAL_BUDGET * 0.2 ? 'var(--warning-color)' : 'var(--error-color)'
                                    }}
                                ></div>
                            </div>
                            {hasPreAuctionWarning && (
                                <div className="pre-auction-warning">
                                    Warning: Budget may be insufficient to meet the minimum roster size of {minSquadSize}.
                                </div>
                            )}
                            <div className="squad-stats">
                                <div className="stat-item">
                                    <span>Players:</span> 
                                    <span className={isMinSizeMet ? 'stat-value-complete' : 'stat-value-incomplete'}>
                                        {s.players.length} / {minSquadSize}
                                    </span>
                                </div>
                                <div className="stat-item">
                                    <span>Female:</span>
                                    <span className={isFemaleMet ? 'stat-value-complete' : 'stat-value-incomplete'}>
                                        {femaleCount} / {minFemalePlayers}
                                    </span>
                                </div>
                                {/* FIX: Use the typed `subSpaceKeys` array for iteration. This resolves errors where the key type was inferred as `any` or `symbol`, causing crashes or type violations. */}
{/* FIX: Reverted to using the `subSpaceKeys` variable. The inline `Object.keys` was causing a type inference issue where `key` was incorrectly assumed to potentially be a symbol, leading to an implicit conversion error at runtime. */}
                                {subSpaceKeys.map(key => {
                                    const met = subSpaceCounts[key] >= subSpaceRequirements[key];
                                    return (
                                        <div className="stat-item" key={key}>
                                            <span>{subSpaceDisplayNames[key]}:</span> 
                                            <span className={met ? 'stat-value-complete' : 'stat-value-incomplete'}>
                                                {subSpaceCounts[key]} / {subSpaceRequirements[key]}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                             <div className="player-list">
                                {s.players.length > 0 ? (
                                    s.players
                                        .slice()
                                        .sort((a,b) => b.soldPrice - a.soldPrice)
                                        .map(p => (
                                            <div className="player-list-item" key={p.id}>
                                                <span className="player-list-item-name" title={p.name}>{p.name}</span>
                                                <span className="player-list-item-price">{formatCurrency(p.soldPrice)}</span>
                                            </div>
                                        ))
                                ) : (
                                    <div className="no-players-placeholder">No players yet.</div>
                                )}
                            </div>
                            <div className="squad-actions">
                                {isNegotiation ? (
                                    <div className="tooltip-container" data-tooltip={negotiationAction ? '' : 'Not your turn'}>
                                        <button
                                            className={`btn ${negotiationAction ? negotiationAction.className : 'btn-primary'} bid-button`}
                                            onClick={negotiationAction ? negotiationAction.action : null}
                                            disabled={!negotiationAction}
                                        >
                                            {negotiationAction ? negotiationAction.text : '...'}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="tooltip-container" data-tooltip={disabledReason || ''}>
                                        <button 
                                            className="btn btn-primary bid-button" 
                                            onClick={() => handleBid(s.id)} 
                                            disabled={!!disabledReason}
                                        >
                                            Bid {formatCurrency(nextBidAmount)}
                                        </button>
                                    </div>
                                )}
                                <button className="btn btn-secondary btn-view-roster" onClick={() => {
                                    pauseTimerForModal();
                                    setRosterModalSquad(s);
                                }}>View Roster</button>
                            </div>
                        </div>
                    )
                })}
            </div>
        );
    };

    const ToastContainer = ({ toasts, onExited }) => {
        return (
            <div className="toast-container">
                {toasts.map(toast => (
                    <div
                        key={toast.id}
                        className={`toast-item ${toast.type} ${toast.exiting ? 'exiting' : ''}`}
                        onAnimationEnd={() => {
                            if (toast.exiting) {
                                onExited(toast.id);
                            }
                        }}
                    >
                        {toast.message}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="app-container">
            <ToastContainer toasts={toasts} onExited={handleToastExited} />
            {animationState.type && <AuctionAnimationOverlay animation={animationState} onAnimationEnd={handleAnimationEnd} formatCurrency={formatCurrency} />}
            {negotiationAnimationState && <NegotiationAnimationOverlay animation={negotiationAnimationState} onAnimationEnd={handleNegotiationAnimationEnd} formatCurrency={formatCurrency} squads={squads} />}
            {error && <div className="error-message">{error}</div>}
            
            <div className="main-layout">
                <aside className="auction-area">
                    {/* 1. Auction Setup */}
                    <div className="card file-uploader-card">
                        <h2>DCL Auction Arena</h2>

                        <div className="location-selector">
                            <label htmlFor="location-select">Auction Location</label>
                            <select
                                id="location-select"
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                disabled={auctionStarted || allPlayers.length > 0}
                            >
                                {Object.keys(LOCATION_CONFIGS).map(loc => <option key={loc} value={loc}>{loc}</option>)}
                            </select>
                        </div>

                        <div className="file-actions">
                            <label htmlFor="file-upload" className={`file-label ${auctionStarted || allPlayers.length > 0 ? 'disabled' : ''}`}>Select Player Roster</label>
                            <input id="file-upload" className="file-input" type="file" accept=".xlsx, .xls" onChange={handleFileUpload} disabled={auctionStarted || allPlayers.length > 0}/>
                            
                            <p className="or-divider">OR</p>

                            <label htmlFor="load-export-upload" className={`file-label btn-secondary ${auctionStarted || allPlayers.length > 0 ? 'disabled' : ''}`}>Load Auction From Export</label>
                            <input id="load-export-upload" className="file-input" type="file" accept=".xlsx" onChange={handleLoadFromExport} disabled={auctionStarted || allPlayers.length > 0} />
                        </div>
                        {fileName && <p className="file-name">{fileName}</p>}

                        {(auctionStarted || allPlayers.length > 0) &&
                            <div className="setup-controls">
                                <button
                                    className="btn btn-danger"
                                    onClick={() => {
                                        pauseTimerForModal();
                                        setModalConfig({
                                            title: 'Confirm Reset',
                                            message: 'Are you sure you want to reset the auction? All current progress will be lost and cannot be undone.',
                                            onConfirm: () => {
                                                resetAuction();
                                                setModalConfig(null);
                                                resumeTimerAfterModal();
                                            },
                                            onCancel: () => {
                                                setModalConfig(null);
                                                resumeTimerAfterModal();
                                            },
                                            confirmButtonText: 'Reset',
                                            confirmButtonClass: 'btn-danger'
                                        })
                                    }}>
                                    Reset
                                </button>
                                <button
                                    title="Settings"
                                    className="btn-icon"
                                    onClick={() => {
                                        pauseTimerForModal();
                                        setIsSettingsModalOpen(true);
                                    }}>
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="history-icon"><path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.08-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49 1c.52.4 1.08.73 1.69.98l-.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49.42l.38-2.65c.61-.25 1.17-.59-1.69-.98l2.49 1c.23.08.49 0 .61.22l-2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/></svg>
                                </button>
                            </div>
                        }
                    </div>

                    {!auctionStarted && players.length > 0 && (
                        <button className="btn btn-primary" onClick={startAuction}>Start Auction</button>
                    )}
                    
                    {/* 2. Export Results */}
                    {auctionStarted && (
                       <div className="card">
                           <button
                                className="btn"
                                onClick={exportAuctionState}
                                style={{width: '100%'}}>
                                Export Current Results
                            </button>
                       </div>
                    )}

                    {/* 3. Remaining Player Counts */}
                    {auctionStarted && !auctionOver && remainingStats && (
                        <div className="card remaining-stats-card">
                            <div>
                                <h4>Remaining Players</h4>
                                <ul>
                                    <li><span>Total Players:</span> <span>{remainingStats.total}</span></li>
                                    <li><span>Female Players:</span> <span>{remainingStats.female}</span></li>
                                    <li><span>{subSpaceDisplayNames.Analytics} Players:</span> <span>{remainingStats.analytics}</span></li>
                                    <li><span>{subSpaceDisplayNames.Tech} Players:</span> <span>{remainingStats.tech}</span></li>
                                    <li><span>{subSpaceDisplayNames.Marketing} Players:</span> <span>{remainingStats.marketing}</span></li>
                                </ul>
                            </div>
                            {players.length > 0 && (
                                <div className="card-actions-footer">
                                    <button className="btn btn-secondary btn-view-roster" onClick={() => {
                                        pauseTimerForModal();
                                        setIsRemainingRosterModalOpen(true);
                                    }}>
                                        View Roster
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                    
                    {/* 4. Unsold Players */}
                    {auctionStarted && (
                        <div className={unsoldPlayersCardClasses.join(' ')}>
                            <div className="unsold-header">
                                <h4>Unsold Players ({unsoldPlayers.length})</h4>
                                <div className="unsold-header-controls">
                                    {!isUnsoldCardCollapsed && unsoldPlayers.length > 0 && (
                                        <div className="select-all-container">
                                            <input
                                                type="checkbox"
                                                id="select-all-unsold"
                                                checked={selectedUnsoldPlayers.length > 0 && selectedUnsoldPlayers.length === unsoldPlayers.length}
                                                onChange={handleToggleSelectAllUnsold}
                                            />
                                            <label htmlFor="select-all-unsold">Select All</label>
                                        </div>
                                    )}
                                     <button className="btn-icon btn-toggle-collapse" onClick={() => setIsUnsoldCardCollapsed(p => !p)} title={isUnsoldCardCollapsed ? "Show Players" : "Hide Players"}>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
                                    </button>
                                </div>
                            </div>
                            {!isUnsoldCardCollapsed && (
                                <>
                                    <ul>
                                        {unsoldPlayers.sort((a, b) => a.name.localeCompare(b.name)).map(p => (
                                            <li key={p.id} className="selectable-list-item">
                                                <label htmlFor={`unsold-select-${p.id}`}>
                                                    <input
                                                        type="checkbox"
                                                        id={`unsold-select-${p.id}`}
                                                        checked={selectedUnsoldPlayers.includes(p.id)}
                                                        onChange={() => handleToggleUnsoldSelection(p.id)}
                                                    />
                                                    {p.name}
                                                </label>
                                            </li>
                                        ))}
                                    </ul>
                                    {unsoldPlayers.length > 0 && (
                                        <div className="card-actions-footer">
                                            <button
                                                className="btn btn-secondary"
                                                onClick={handleReAuctionSelected}
                                                disabled={selectedUnsoldPlayers.length === 0}
                                            >
                                                Re-auction ({selectedUnsoldPlayers.length})
                                            </button>
                                            {auctionOver && (
                                                <button className="btn btn-primary" onClick={() => {
                                                    pauseTimerForModal();
                                                    setIsBulkAssignModalOpen(true);
                                                }}>
                                                    Bulk Assign
                                                </button>
                                            )}
                                            <button className="btn btn-secondary btn-view-roster" onClick={() => {
                                                pauseTimerForModal();
                                                setIsUnsoldRosterModalOpen(true);
                                            }}>
                                                View Roster
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}


                    {auctionOver && (
                       <div className="card">
                           <h2>Auction Over!</h2>
                           <p>All players have been presented.</p>
                           {unsoldPlayers.length > 0 && (
                               <p style={{marginTop: '1rem', color: 'var(--text-secondary)', textAlign: 'center'}}>
                                   Select players from the unsold list to re-auction them.
                               </p>
                           )}
                       </div>
                    )}
                </aside>
                
                <main className="main-content-area">
                    <div className="dashboard-header">
                        <div className="main-tabs">
                            <button
                                className={`main-tab-button ${activeMainTab === 'dashboard' ? 'active' : ''}`}
                                onClick={() => setActiveMainTab('dashboard')}
                            >
                                Squads Dashboard
                            </button>
                            <button
                                className={`main-tab-button ${activeMainTab === 'trading' ? 'active' : ''}`}
                                onClick={() => setActiveMainTab('trading')}
                                disabled={!auctionOver}
                                title={!auctionOver ? "Trading opens after the auction is complete" : ""}
                            >
                                Trading Block
                            </button>
                        </div>
                         {activeMainTab === 'dashboard' && (
                            <div className="search-and-compare-wrapper">
                                <div className="search-container">
                                    <input
                                        type="text"
                                        placeholder="Search for a player by name..."
                                        className="search-input"
                                        value={searchQuery}
                                        onChange={(e) => handleSearch(e.target.value)}
                                    />
                                </div>
                                {squads.length > 0 && squadsToCompare.length >= 2 && (
                                    <div className="compare-controls">
                                        <button className="btn btn-primary" onClick={() => { pauseTimerForModal(); setIsCompareModalOpen(true); }}>
                                            Compare ({squadsToCompare.length})
                                        </button>
                                        <button className="btn btn-secondary" onClick={() => setSquadsToCompare([])}>
                                            Clear
                                        </button>
                                    </div>
                                )}
                            </div>
                         )}
                        <SearchResultDisplay result={searchResult} />
                    </div>

                    {activeMainTab === 'dashboard' && tradeAuctionState.status !== 'active' && (
                        <div className="squads-dashboard">
                            <div className="top-dashboard-layout">
                                <div className="current-player-area">
                                    {auctionStarted && currentPlayer && (
                                        <>
                                            {/* FIX: Add missing negotiation timer props to CurrentPlayerCard to satisfy its signature. These are not used in this context. */}
                                            <CurrentPlayerCard
                                                isTradeAuction={false}
                                                sellingSquadId={null}
                                                negotiationOffer={null}
                                                isCompactNegotiationView={false}
                                                negotiationTimerValue={0}
                                                isNegotiationTimerRunning={false}
                                                negotiationTimerKey={0}
                                                negotiationTimerDuration={0}
// FIX: Added missing onToggleNegotiationTimer prop to satisfy the component's signature. A no-op is safe here as this timer is not active in this context.
                                                onToggleNegotiationTimer={() => {}}
                                            />
                                            <div className="card current-player-actions-card">
                                                <div className="auction-controls">
                                                    <button className="btn btn-success" onClick={sellPlayer} disabled={!highestBidder}>Sell Player</button>
                                                    <button className="btn btn-secondary" onClick={moveToNextPlayer}>Next Player (Unsold)</button>
                                                    <button className="btn btn-secondary" onClick={handleUndo} disabled={history.length === 0}>Undo Last Action</button>
                                                </div>
                                                <div className="base-price-assign">
                                                    <select onChange={(e) => setAssigneeSquadId(parseInt(e.target.value))} value={assigneeSquadId || ''}>
                                                        <option value="">Select squad to assign...</option>
                                                        {squads.map(s => (
                                                            <option key={s.id} value={s.id} disabled={!canSquadBid(s, BASE_PRICE)}>
                                                                {s.name} ({formatCurrency(s.budget)})
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button className="btn btn-primary" onClick={handleAssignAtBasePrice} disabled={!assigneeSquadId}>
                                                        Assign at Base Price
                                                    </button>
                                                </div>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
{/* FIX: Pass sellingSquadId prop to satisfy component's required props. It is null for non-trade auctions. */}
                            <SquadCardsContainer isTradeAuction={false} sellingSquadId={null} negotiationOffer={null} onOfferResponse={handleOfferResponse} onCounterOffer={handleCounterOffer} />
                        </div>
                    )}

                    {activeMainTab === 'trading' && <TradingBlock />}
                </main>
            </div>
            {rosterModalSquad && <RosterModal squad={rosterModalSquad} onClose={() => {
                resumeTimerAfterModal();
                setRosterModalSquad(null);
            }} onPlayerHistoryClick={(p) => {
                pauseTimerForModal();
                setViewingBidHistoryForPlayer(p);
            }} />}
            {viewingBidHistoryForPlayer && <BidHistoryModal player={viewingBidHistoryForPlayer} squads={squads} onClose={() => {
                resumeTimerAfterModal();
                setViewingBidHistoryForPlayer(null);
            }} />}
            {isUnsoldRosterModalOpen && (
                <RosterModal
                    squad={{ name: 'Unsold Players', players: unsoldPlayers }}
                    onClose={() => {
                        resumeTimerAfterModal();
                        setIsUnsoldRosterModalOpen(false);
                    }}
                    onPlayerHistoryClick={(p) => {
                        pauseTimerForModal();
                        setViewingBidHistoryForPlayer(p);
                    }}
                    isUnsoldList={true}
                />
            )}
            {isRemainingRosterModalOpen && (
                <RosterModal
                    squad={{ name: 'Remaining Players', players: players }}
                    onClose={() => {
                        resumeTimerAfterModal();
                        setIsRemainingRosterModalOpen(false);
                    }}
                    onPlayerHistoryClick={(p) => {
                        pauseTimerForModal();
                        setViewingBidHistoryForPlayer(p);
                    }}
                    isUnsoldList={true}
                />
            )}
            {isBulkAssignModalOpen && (
                <BulkAssignModal
                    isOpen={isBulkAssignModalOpen}
                    onClose={() => {
                        resumeTimerAfterModal();
                        setIsBulkAssignModalOpen(false);
                    }}
                    onConfirm={(assignments) => {
                        handleBulkAssignConfirm(assignments);
                        resumeTimerAfterModal();
                    }}
                    unsoldPlayers={unsoldPlayers}
                    squads={squads}
                    config={{ BASE_PRICE, minSquadSize: minSquadSize }}
                />
            )}
            {isSettingsModalOpen && (
                <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => {
                        resumeTimerAfterModal();
                        setIsSettingsModalOpen(false);
                    }}
                    onSave={setSettings}
                    currentSettings={settings}
                    subSpaceDisplayNames={subSpaceDisplayNames}
                />
            )}
            {isCompareModalOpen && (
                <SquadComparisonModal
                    isOpen={isCompareModalOpen}
                    onClose={() => { resumeTimerAfterModal(); setIsCompareModalOpen(false); }}
                    allSquads={squads}
                    squadIdsToCompare={squadsToCompare}
                    config={{ minSquadSize, minFemalePlayers, subSpaceRequirements }}
                    formatCurrency={formatCurrency}
                    subSpaceDisplayNames={subSpaceDisplayNames}
                />
            )}
{/* FIX: Replaced rest parameters `...args` with explicit arguments for the onConfirm callback. This resolves a TypeScript error where the type of `args` could not be inferred as a tuple, preventing the use of the spread operator. */}
            {offerConfig && <MakeOfferModal isOpen={!!offerConfig} onClose={() => { resumeTimerAfterModal(); setOfferConfig(null); }} onConfirm={(requestingSquadId, owningSquad, player, price) => { handleMakeOffer(requestingSquadId, owningSquad, player, price); resumeTimerAfterModal(); }} {...offerConfig} allSquads={squads} />}
            {nominationConfig && <NominationModal />}
            {counterOfferConfig && <CounterOfferModal isOpen={!!counterOfferConfig} onClose={() => { resumeTimerAfterModal(); setCounterOfferConfig(null); }} onConfirm={handleCounterOffer} offer={counterOfferConfig.offer} />}
            {modalConfig && <ConfirmationModal {...modalConfig} />}
        </div>
    );
};

    root.render(<Baap />);