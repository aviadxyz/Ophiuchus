import hashlib
import json
import os
import time
from contextlib import contextmanager
from pathlib import Path
from knowledge_ingestion.storage import atomic_json, atomic_bytes

BOUNDARY = Path(__file__).resolve().parents[2]


def contained(path):
    path = Path(path).resolve()
    if not path.is_relative_to(BOUNDARY):
        raise ValueError('Focused writes must remain inside DB layer')
    return path


def write_json(path, value):
    path = contained(path)
    for attempt in range(12):
        try:
            atomic_json(path, value)
            return
        except PermissionError:
            if attempt == 11:
                raise
            # Windows readers can briefly deny replacement; preserve the old
            # complete file and retry instead of losing the committed checkpoint.
            time.sleep(0.05)


def write_bytes(path, value):
    path = contained(path)
    for attempt in range(12):
        try:
            atomic_bytes(path, value)
            return
        except PermissionError:
            if attempt == 11:
                raise
            time.sleep(0.05)


def digest(content):
    return hashlib.sha256(content).hexdigest()


def read_rows(path):
    import csv
    path = Path(path)
    if not path.exists():
        return []
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


@contextmanager
def writer_lock(root):
    root = contained(root)
    path = contained(root/'staging/focused/writer.lock')
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+b') as stream:
        stream.seek(0,2)
        if stream.tell() == 0:
            stream.write(b'0')
            stream.flush()
        stream.seek(0)
        try:
            if os.name == 'nt':
                import msvcrt
                msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError as error:
            raise RuntimeError('Another focused writer is active; no CSV changes performed') from error
        try:
            yield
        finally:
            stream.seek(0)
            if os.name == 'nt':
                msvcrt.locking(stream.fileno(),msvcrt.LK_UNLCK,1)
            else:
                fcntl.flock(stream.fileno(),fcntl.LOCK_UN)
