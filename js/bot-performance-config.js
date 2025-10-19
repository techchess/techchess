// Bot Performance Configuration
// Optimizations to reduce lag when bot is thinking

const BotPerformanceConfig = {
    // Search depth - lower = faster but weaker play
    depth: 3, // Reduced to 3 for instant response
    
    // Quiescence search depth - how deep to search tactical sequences
    quiescenceDepth: 1, // Reduced to 1 for speed
    
    // Time limit per move in milliseconds
    timeLimit: 1000, // 1 second max for faster moves
    
    // Yield interval - how often to yield to UI (in nodes searched)
    yieldInterval: 50, // Reduced to 50 for maximum UI responsiveness during bot thinking
    
    // Transposition table size
    transpositionTableMaxSize: 30000, // Reduced from 50000 to 30000
    
    // Opening book - use book for first N moves
    openingBookDepth: 8, // Half-moves (4 full moves)
    
    // Move ordering optimizations
    enableMoveOrdering: true,
    enableKillerMoves: true,
    enableHistoryHeuristic: true,
    
    // Search optimizations
    enableAspirationWindows: true,
    enablePrincipalVariationSearch: true,
    enableIterativeDeepening: true,
    
    // Evaluation features (disable expensive ones)
    evaluation: {
        enablePawnStructure: true,
        enableKingSafety: true,
        enableBishopPair: true,
        enablePassedPawns: false, // Disabled for performance
        enableRookPlacement: false, // Disabled for performance
        enableKnightOutposts: false, // Disabled for performance
        enableMobility: true
    },
    
    // Performance monitoring
    logPerformance: false, // Set to true to see detailed timing
    logNodeCount: true
};

// Apply configuration to bot
function applyPerformanceConfig(bot, config = BotPerformanceConfig) {
    // Apply depth
    bot.depth = config.depth;
    
    // Apply yield interval
    bot.yieldInterval = config.yieldInterval;
    
    console.log('🚀 Bot Performance Config Applied:');
    console.log(`   Search Depth: ${config.depth}`);
    console.log(`   Quiescence Depth: ${config.quiescenceDepth}`);
    console.log(`   Yield Interval: ${config.yieldInterval} nodes`);
    console.log(`   Time Limit: ${config.timeLimit}ms`);
    console.log(`   Transposition Table: ${config.transpositionTableMaxSize} entries`);
}

// Aggressive performance mode - for maximum responsiveness
const AggressivePerformanceConfig = {
    depth: 3, // Very fast
    quiescenceDepth: 1,
    timeLimit: 2000,
    yieldInterval: 30,
    transpositionTableMaxSize: 20000,
    openingBookDepth: 10, // Rely more on opening book
    enableMoveOrdering: true,
    enableKillerMoves: true,
    enableHistoryHeuristic: false,
    enableAspirationWindows: false,
    enablePrincipalVariationSearch: true,
    enableIterativeDeepening: true,
    evaluation: {
        enablePawnStructure: true,
        enableKingSafety: true,
        enableBishopPair: false,
        enablePassedPawns: false,
        enableRookPlacement: false,
        enableKnightOutposts: false,
        enableMobility: false
    }
};

// Balanced mode - good mix of strength and speed
const BalancedPerformanceConfig = {
    depth: 4,
    quiescenceDepth: 2,
    timeLimit: 3000,
    yieldInterval: 50,
    transpositionTableMaxSize: 30000,
    openingBookDepth: 8,
    enableMoveOrdering: true,
    enableKillerMoves: true,
    enableHistoryHeuristic: true,
    enableAspirationWindows: true,
    enablePrincipalVariationSearch: true,
    enableIterativeDeepening: true,
    evaluation: {
        enablePawnStructure: true,
        enableKingSafety: true,
        enableBishopPair: true,
        enablePassedPawns: false,
        enableRookPlacement: false,
        enableKnightOutposts: false,
        enableMobility: true
    }
};

// Strong mode - prioritize strength over speed
const StrongPerformanceConfig = {
    depth: 5,
    quiescenceDepth: 3,
    timeLimit: 5000,
    yieldInterval: 200,
    transpositionTableMaxSize: 50000,
    openingBookDepth: 8,
    enableMoveOrdering: true,
    enableKillerMoves: true,
    enableHistoryHeuristic: true,
    enableAspirationWindows: true,
    enablePrincipalVariationSearch: true,
    enableIterativeDeepening: true,
    evaluation: {
        enablePawnStructure: true,
        enableKingSafety: true,
        enableBishopPair: true,
        enablePassedPawns: true,
        enableRookPlacement: false,
        enableKnightOutposts: false,
        enableMobility: true
    }
};

// Export configurations
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        BotPerformanceConfig,
        AggressivePerformanceConfig,
        BalancedPerformanceConfig,
        StrongPerformanceConfig,
        applyPerformanceConfig
    };
}

