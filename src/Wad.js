var Wad = function (bytes) {
    this.readByteAt = function (offset) { 
        return this.bytes[offset];
    }

    this.readInt32At = function (offset) {
        var val =
            (this.bytes[offset    ] << 0) + 
            (this.bytes[offset + 1] << 8) +
            (this.bytes[offset + 2] << 16) +
            (this.bytes[offset + 3] << 24);

        return val;
    }

    this.readInt16At = function (offset) {
        var val =
            (this.bytes[offset    ] << 0) + 
            (this.bytes[offset + 1] << 8);

        if (val > 32767) {
            val = -65536 + val;
        }

        return val;
    }

    this.readStringAt = function (offset, maxLength) {
        var s = "";

        var i = 0;

        do {
            var b = this.bytes[offset + i];

            if (b) {
                s += String.fromCharCode(b);
            }

            i++;
        } while (i < maxLength);

        return s;
    }

    this.dumpLumps = function() {
        for (var i = 0; i < this.NumLumps; i++) {
            var directoryEntryOffset = this.DirectoryOffset + i * 16;
            
            var lumpName = this.readStringAt(directoryEntryOffset + 8, 8);

            window.console.log(lumpName);
        }
    }

    this.getFirstMatchingLumpAfterSpecifiedLumpIndex = function(name, startIndex) {
        for (var i = startIndex; i < this.NumLumps; i++) {
            var directoryEntryOffset = this.DirectoryOffset + i * 16;
            
            var lumpName = this.readStringAt(directoryEntryOffset + 8, 8);

            if (lumpName == name) {
                return {
                    offset: this.readInt32At(directoryEntryOffset),
                    length: this.readInt32At(directoryEntryOffset + 4),
                    name: name,
                    lumpIndex: i
                };
            }
        }
    }

    this.bytes = bytes;

    this.NumLumps = this.readInt32At(4);
    this.DirectoryOffset = this.readInt32At(8);
}

export { Wad };