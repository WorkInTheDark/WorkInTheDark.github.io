#!/usr/bin/env ruby
# Checks translation tables: every row translated, {tokens} intact, Chinese punctuation, no dashes.
#   ruby tools/phd-sim/i18n-check.rb [files...]   (default: every table in _data/phd_sim_i18n/zh)
# Exits non-zero if any file has problems. Reads only the files given, so helpers can check their own.
Encoding.default_external = Encoding::UTF_8
require "yaml"

root = File.expand_path("../..", __dir__)
files = ARGV.empty? ? Dir.glob(File.join(root, "_data", "phd_sim_i18n", "zh", "**", "*.yml")).sort : ARGV
TOKEN = /\{[a-z0-9_]+(?:\.[a-z0-9_]+)?(?::\d+-\d+)?(?:\|[a-z]+)?\}/i
CJK = /\p{Han}/
bad_total = 0
rows_total = 0
done_total = 0

files.each do |f|
  next if File.basename(f) == "_stale.yml"
  begin
    rows = YAML.safe_load(File.read(f)) || []
  rescue Psych::SyntaxError => e
    puts "#{f}: YAML error: #{e.message}"
    bad_total += 1
    next
  end
  problems = []
  done = 0
  rows.each_with_index do |r, i|
    en = r["en"].to_s
    zh = r["zh"].to_s
    rows_total += 1
    if zh.strip.empty?
      problems << "row #{i + 1}: not translated: #{en[0, 60]}"
      next
    end
    done += 1
    te = en.scan(TOKEN).sort
    tz = zh.scan(TOKEN).sort
    problems << "row #{i + 1}: tokens differ #{te.inspect} vs #{tz.inspect}" if te != tz
    problems << "row #{i + 1}: dash in: #{zh[0, 60]}" if zh =~ /——|—|–/
    problems << "row #{i + 1}: half-width punctuation between Chinese characters: #{zh[0, 60]}" if zh =~ /\p{Han}[,.?!:;]\p{Han}|\p{Han}[,?!:;]\s*$/
    # Text with letters in English should usually come back with Chinese in it (names and venues excepted).
    problems << "row #{i + 1}: no Chinese characters: #{zh[0, 60]}" if zh !~ CJK && en =~ /[a-z]{3,} [a-z]{3,}/ && zh == en
  end
  done_total += done
  if problems.any?
    bad_total += problems.size
    puts "#{f.sub(root + '/', '')}: #{done}/#{rows.size} translated, #{problems.size} problems"
    problems.first(12).each { |p| puts "  " + p }
    puts "  ..." if problems.size > 12
  else
    puts "#{f.sub(root + '/', '')}: #{done}/#{rows.size} translated, OK"
  end
end
puts "#{done_total} of #{rows_total} strings translated, #{bad_total} problems"
exit(bad_total.zero? ? 0 : 1)
