from core.scanner import RepositoryScanner


def test_scanner_finds_files(tmp_path):
    """The scanner should find files inside a repository."""

    repository = tmp_path / "sample_repo"
    repository.mkdir()

    file_one = repository / "main.py"
    file_two = repository / "README.md"

    file_one.write_text("print('hello')")
    file_two.write_text("# Sample Repository")

    scanner = RepositoryScanner(repository)

    files = scanner.scan()

    assert file_one in files
    assert file_two in files