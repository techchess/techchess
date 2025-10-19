#!/usr/bin/env python3
"""
Build Opening Book from Lichess PGN Database
Based on Sebastian Lague's approach to chess bot training
"""

import re
import json
from collections import defaultdict
import sys

class LichessOpeningBookBuilder:
    def __init__(self):
        self.game_database = defaultdict(lambda: {'moves': [], 'frequencies': [], 'total_games': 0})
        self.min_games = 3
        self.max_depth = 15
        self.max_games = 50000  # Process more games than browser version
        self.processed_games = 0

    def extract_moves_from_game(self, game_text):
        """Extract moves from a single game"""
        lines = game_text.strip().split('\n')
        
        # Find the moves line (usually the last non-empty line)
        move_text = ''
        for line in reversed(lines):
            line = line.strip()
            if line and not line.startswith('[') and not line.startswith('1-0') and not line.startswith('0-1') and not line.startswith('1/2-1/2'):
                move_text = line
                break
        
        if not move_text:
            return []
        
        # Parse moves using regex
        move_pattern = r'(\d+\.\s*)?([NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](?:=[NBRQ])?[+#]?)'
        matches = re.findall(move_pattern, move_text)
        
        moves = []
        for match in matches:
            move = match[1].replace('+', '').replace('#', '')  # Remove check/checkmate symbols
            if len(move) >= 2 and self.is_valid_move(move):
                moves.append(move)
        
        return moves

    def is_valid_move(self, move):
        """Basic move validation"""
        # Simple SAN move pattern
        pattern = r'^[NBRQK]?[a-h]?[1-8]?x?[a-h][1-8](=[NBRQ])?$'
        return bool(re.match(pattern, move))

    def process_game(self, moves):
        """Process a single game and update statistics"""
        if len(moves) < 4:
            return
        
        move_history = []
        
        for i in range(min(len(moves), self.max_depth)):
            move = moves[i]
            move_history.append(move)
            
            # Use move history as position key
            position_key = ' '.join(move_history)
            
            self.game_database[position_key]['total_games'] += 1
            
            # Add next move if it exists
            if i + 1 < len(moves):
                next_move = moves[i + 1]
                position_data = self.game_database[position_key]
                
                if next_move in position_data['moves']:
                    idx = position_data['moves'].index(next_move)
                    position_data['frequencies'][idx] += 1
                else:
                    position_data['moves'].append(next_move)
                    position_data['frequencies'].append(1)

    def filter_weak_moves(self):
        """Remove positions and moves that appear too infrequently"""
        print("🔍 Filtering weak moves...")
        
        positions_to_remove = []
        for position_key, data in self.game_database.items():
            if data['total_games'] < self.min_games:
                positions_to_remove.append(position_key)
                continue
            
            # Filter moves that appear in less than 15% of games
            min_frequency = max(1, int(data['total_games'] * 0.15))
            
            moves_to_remove = []
            for i in range(len(data['moves'])):
                if data['frequencies'][i] < min_frequency:
                    moves_to_remove.append(i)
            
            # Remove moves in reverse order to maintain indices
            for i in reversed(moves_to_remove):
                data['moves'].pop(i)
                data['frequencies'].pop(i)
            
            # Remove position if no moves left
            if not data['moves']:
                positions_to_remove.append(position_key)
        
        # Remove weak positions
        for position_key in positions_to_remove:
            del self.game_database[position_key]
        
        print(f"🗑️ Removed {len(positions_to_remove)} weak positions")

    def generate_opening_book(self):
        """Generate the final opening book"""
        opening_book = {
            'white': [],
            'black': []
        }
        
        for position_key, data in self.game_database.items():
            moves = position_key.split(' ')
            is_white = len(moves) % 2 == 0  # Even number of moves = black's turn
            
            # Add the most popular moves from this position
            for i, move in enumerate(data['moves']):
                opening_line = position_key + ' ' + move
                
                if is_white:
                    opening_book['white'].append(opening_line)
                else:
                    opening_book['black'].append(opening_line)
        
        return opening_book

    def process_pgn_file(self, filename):
        """Process the entire PGN file"""
        print(f"🔄 Processing {filename}...")
        
        with open(filename, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # Split into individual games
        games = content.split('\n\n[Event')
        print(f"📊 Found {len(games)} games")
        
        # Process games
        for i, game in enumerate(games[:self.max_games]):
            if i > 0:
                game = '[Event' + game
            
            moves = self.extract_moves_from_game(game)
            if moves:
                self.process_game(moves)
                self.processed_games += 1
            
            if (i + 1) % 1000 == 0:
                print(f"📈 Processed {i + 1} games...")
        
        print(f"✅ Processed {self.processed_games} games total")
        
        # Filter and generate opening book
        self.filter_weak_moves()
        opening_book = self.generate_opening_book()
        
        return opening_book

    def save_opening_book(self, opening_book, output_file):
        """Save opening book as JavaScript code"""
        print(f"💾 Saving opening book to {output_file}...")
        
        with open(output_file, 'w') as f:
            f.write("// Master Opening Book - Generated from Lichess Database\n")
            f.write("// Based on Sebastian Lague's approach\n\n")
            f.write("const MASTER_OPENING_BOOK = {\n")
            f.write("    white: [\n")
            
            for line in opening_book['white']:
                f.write(f'        "{line}",\n')
            
            f.write("    ],\n")
            f.write("    black: [\n")
            
            for line in opening_book['black']:
                f.write(f'        "{line}",\n')
            
            f.write("    ]\n")
            f.write("};\n")
        
        print(f"✅ Opening book saved!")

def main():
    print("🧠 Lichess Opening Book Builder (EXPANDED)")
    print("=" * 50)
    
    builder = LichessOpeningBookBuilder()
    builder.max_games = 100000  # Process more games from the larger database
    
    # Process both PGN files
    print("\n📚 Processing 2014 database...")
    opening_book_2014 = builder.process_pgn_file('lichess_games.pgn')
    
    print("\n📚 Processing 2016 database (larger)...")
    opening_book_2016 = builder.process_pgn_file('lichess_games_2016.pgn')
    
    # Merge the two opening books
    print("\n🔄 Merging opening books...")
    merged_book = {
        'white': list(set(opening_book_2014['white'] + opening_book_2016['white'])),
        'black': list(set(opening_book_2014['black'] + opening_book_2016['black']))
    }
    
    # Print statistics
    print(f"\n📈 Combined Opening Book Statistics:")
    print(f"• White lines: {len(merged_book['white'])}")
    print(f"• Black lines: {len(merged_book['black'])}")
    print(f"• Total unique positions: {len(merged_book['white']) + len(merged_book['black'])}")
    print(f"• Games processed: {builder.processed_games}")
    
    # Save merged opening book
    builder.save_opening_book(merged_book, 'master_opening_book.js')
    
    print(f"\n🎉 Done! Your expanded master opening book is ready!")
    print(f"📁 File: master_opening_book.js")
    print(f"💡 The bot will now have significantly more opening knowledge!")

if __name__ == "__main__":
    main()
