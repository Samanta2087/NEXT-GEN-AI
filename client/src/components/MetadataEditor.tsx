import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Save, Image, User, Disc, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ConversionJob } from "@shared/schema";

interface MetadataEditorProps {
  job: ConversionJob;
  isOpen: boolean;
  onClose: () => void;
  onSave: (metadata: NonNullable<ConversionJob["metadata"]>) => void;
}

export function MetadataEditor({ job, isOpen, onClose, onSave }: MetadataEditorProps) {
  const [title, setTitle] = useState(job.metadata?.title || job.originalName.replace(/\.[^/.]+$/, ""));
  const [artist, setArtist] = useState(job.metadata?.artist || "");
  const [album, setAlbum] = useState(job.metadata?.album || "");
  const [coverArt, setCoverArt] = useState(job.metadata?.coverArt || "");

  const handleSave = () => {
    onSave({
      title: title.trim() || undefined,
      artist: artist.trim() || undefined,
      album: album.trim() || undefined,
      coverArt: coverArt.trim() || undefined,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-strong border-white/40 max-w-md">
        <div className="noise" />
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="p-2 rounded-lg gradient-accent">
              <Music className="w-5 h-5 text-white" />
            </div>
            Edit Metadata
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div className="space-y-2">
            <Label htmlFor="title" className="flex items-center gap-2 text-muted-foreground">
              <Disc className="w-4 h-4" />
              Track Title
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter track title"
              className="bg-white/50 border-primary/20 focus:border-primary/50"
              data-testid="input-metadata-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="artist" className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" />
              Artist
            </Label>
            <Input
              id="artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              placeholder="Enter artist name"
              className="bg-white/50 border-primary/20 focus:border-primary/50"
              data-testid="input-metadata-artist"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="album" className="flex items-center gap-2 text-muted-foreground">
              <Disc className="w-4 h-4" />
              Album
            </Label>
            <Input
              id="album"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              placeholder="Enter album name"
              className="bg-white/50 border-primary/20 focus:border-primary/50"
              data-testid="input-metadata-album"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="coverArt" className="flex items-center gap-2 text-muted-foreground">
              <Image className="w-4 h-4" />
              Cover Art URL
            </Label>
            <Input
              id="coverArt"
              value={coverArt}
              onChange={(e) => setCoverArt(e.target.value)}
              placeholder="https://example.com/cover.jpg"
              className="bg-white/50 border-primary/20 focus:border-primary/50"
              data-testid="input-metadata-cover"
            />
          </div>

          {coverArt && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex justify-center"
            >
              <div className="w-24 h-24 rounded-xl overflow-hidden border-2 border-primary/20 shadow-lg">
                <img
                  src={coverArt}
                  alt="Cover preview"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              </div>
            </motion.div>
          )}

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1 glass"
              data-testid="button-cancel-metadata"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="flex-1 gradient-primary text-white"
              data-testid="button-save-metadata"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
